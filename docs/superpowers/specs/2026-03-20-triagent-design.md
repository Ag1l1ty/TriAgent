# TriAgent — Design Specification

**Date:** 2026-03-20
**Status:** Approved
**Stack:** TypeScript + Node.js 24+

## 1. Overview

TriAgent is a CLI orchestrator that coordinates three AI coding agents (Claude Code, ForgeCode, Codex CLI) from a single terminal. It acts as an intelligent tmux — decomposing tasks, assigning them to agents based on configurable strengths, isolating work via Git worktrees, and presenting a real-time TUI dashboard.

### Key Decisions

| Aspect | Decision |
|--------|----------|
| User model | Solo developer |
| Interaction | Hybrid — TriAgent proposes task distribution, user approves before execution |
| Agent routing | Configurable per-project via `triagent.config.yaml` |
| Conflict avoidance | Git worktrees (one per agent, same base commit) |
| Stack | TypeScript + Node.js |
| MVP scope | Full development session (plan → implement → test → commit) |
| Architecture | Event-Driven Orchestrator |

### Default Agent Strengths

| Agent | Command | Auth | Domains |
|-------|---------|------|---------|
| Claude Code | `claude` | Claude Code Max (session in `~/.claude/`) | Planning, Design, Frontend |
| ForgeCode | `forge` | Claude Code Max (shared session) | Backend, Architecture, Refactoring |
| Codex CLI | `codex` | ChatGPT Team (session via `codex` login) | Testing, Docs, CI/CD, APIs, Config |

### Authentication Constraint

**TriAgent is an orchestrator, not an auth proxy.** Each agent maintains its own authentication session. TriAgent:
- Inherits the full shell environment when spawning agent processes (env vars, paths, tokens)
- Never passes API keys as parameters
- Detects auth failures and pauses only the affected agent, prompting the user to re-login
- Never attempts to re-authenticate on behalf of an agent

## 2. Architecture

Event-Driven Orchestrator with 6 core components connected via a typed EventEmitter bus.

```
┌─────────────────────────────────────────────────────────────┐
│                      TUI Dashboard                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Claude   │  │ Forge    │  │ Codex    │  │ Task Queue │ │
│  │ Panel    │  │ Panel    │  │ Panel    │  │ & Status   │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ subscribes to events
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Bus (EventEmitter)                  │
│                                                             │
│  Events: task:created, task:assigned, agent:output,         │
│          agent:status, git:merge, agent:error, agent:done   │
└──┬──────────────┬──────────────┬──────────────┬─────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│Planner │  │Scheduler │  │Agent     │  │Worktree      │
│        │  │          │  │Drivers   │  │Manager       │
│Decompose│  │Route by  │  │(x3)     │  │              │
│task into│  │strengths │  │          │  │Create/merge  │
│subtasks │  │+ deps    │  │Spawn CLI │  │worktrees     │
└────────┘  └──────────┘  │processes │  └──────────────┘
                          └────┬─────┘
                               │ inherits shell env (auth)
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         [ claude ]       [ forge ]        [ codex ]
         Max auth         Max auth         Team auth
              │                │                │
              ▼                ▼                ▼
         [ worktree ]    [ worktree ]     [ worktree ]
         /claude         /forge           /codex
```

### Component Responsibilities

#### Event Bus (`core/event-bus.ts`)
- Typed EventEmitter (using `eventemitter3`)
- All components publish and subscribe — no direct coupling
- Enables automatic logging and event replay for debugging
- Event types defined in `types.ts`

#### Planner (`core/planner.ts`)
- Receives a high-level task from the user (natural language string)
- Decomposes it into sub-tasks, each tagged with a domain (`frontend`, `backend`, `testing`, etc.)
- Identifies dependencies between sub-tasks (e.g., "tests" depends on "implementation")
- Emits `task:created` events for each sub-task
- **Implementation note:** The Planner uses heuristics and keyword matching for domain classification, not an LLM call. This keeps TriAgent itself free of token costs. Users can override classifications during the approval gate.

#### Scheduler (`core/scheduler.ts`)
- Reads `triagent.config.yaml` to map domains → agents
- Builds a dependency graph from the Planner's output
- Determines execution order: independent tasks in parallel, dependent tasks sequential
- Presents the proposed assignment to the user for approval (via TUI approval gate)
- Emits `task:assigned` events after user confirms

##### Routing Precedence (highest to lowest)
1. **User override** at approval gate (manual reassignment)
2. **Path-based domain mapping** from config (`domains` section — glob match on task's `targetPaths`)
3. **Strength-based routing** (domain tag → agent strengths match)
4. **Fallback:** first agent with available capacity

#### Agent Drivers (`drivers/`)
- Abstract `BaseDriver` class with concrete implementations: `ClaudeDriver`, `ForgeDriver`, `CodexDriver`
- Each driver:
  - Spawns the agent CLI as a child process via `node-pty` (inheriting full shell env)
  - **CRITICAL: Always spawn using argv array, never shell command strings** — prevents shell injection from task descriptions
  - Sets `cwd` to the agent's worktree directory
  - Passes the sub-task as a prompt string directly as an argv argument (no shell interpolation)
  - Buffers stdout in a circular buffer (max 500 lines per agent), flushed to Event Bus at most every 100ms (configurable via `session.tui_refresh_ms`). The TUI subscribes to debounced render events, not raw `agent:output`
  - Detects completion (process exit code), emitting `agent:done` — **exit code is the primary completion signal, not output parsing**
  - Detects errors (non-zero exit, auth failure patterns), emitting `agent:error`
  - Supports lifecycle: `start()`, `pause()` (SIGSTOP), `resume()` (SIGCONT), `kill()` (SIGTERM)

##### Agent CLI Invocation

Each agent is invoked headlessly with the task as a prompt. **Drivers must use argv arrays, never shell strings:**

```typescript
// CORRECT — argv array, no shell involved
pty.spawn('claude', ['--dangerously-skip-permissions', '-p', taskDescription], {
  cwd: worktreePath,
  env: process.env  // inherit full shell env (auth tokens)
});

// WRONG — shell injection possible if taskDescription contains metacharacters
pty.spawn('/bin/sh', ['-c', `claude -p "${taskDescription}"`]);
```

**Note:** The exact flags for headless/non-interactive mode may vary by agent version. The `args` array (excluding the task prompt) is configurable per-agent in config. The `--dangerously-skip-permissions` flag is the starting point — each driver validates the correct invocation at health check time.

##### Security: `--dangerously-skip-permissions` Blast Radius

When an agent runs with `--dangerously-skip-permissions`, it can write anywhere the user's shell has access — not just its worktree. With 3 agents running simultaneously, the filesystem blast radius is 3x a single session. **Mitigations:**
- Document this constraint prominently in user-facing docs
- Agents are instructed (via prompt) to only modify files in their assigned worktree
- Future: explore `--allowed-dir` flags if agent CLIs support directory scoping

#### Worktree Manager (`git/worktree-mgr.ts`)
- Before execution: creates one Git worktree per active agent
  - Directory: `.triagent/worktrees/{agent-name}/`
  - Branch: `triagent/{agent-name}-{session-id}`
  - All worktrees branch from the same base commit
- After execution: merges agent branches into the base branch

##### Merge Strategy

The unit of merge is the **full agent branch** (not per-task). Merge is triggered after an agent's last assigned task completes.

**`sequential` strategy (default):**
- Merge order is determined by the last dependency round the agent had work in. Agents finishing in earlier rounds merge first.
- Clean merges auto-proceed
- Conflicting merges pause and present options to the user:
  1. Resolve manually
  2. Delegate conflict resolution to an agent
  3. Abort that agent's changes

**`manual` strategy:**
- No auto-merge. User must explicitly approve each merge via TUI approval gate or run `triagent merge`
- Each pending merge is shown with a diff summary for review

- Cleanup: removes worktree directories and temporary branches after successful merge

#### TUI Dashboard (`tui/`)
- Built with Ink 5 (React for terminal)
- Layout: 3 agent panels + 1 task/status panel in a grid
- Each agent panel shows:
  - Agent name and status (idle / working / paused / error)
  - Real-time stdout streaming (scrollable, last N lines)
  - Current sub-task being executed
- Task panel shows:
  - Sub-task queue with status (pending / running / done / failed)
  - Dependency arrows between tasks
- Status bar shows: session elapsed time, agents active, hotkeys
- Approval gate: full-screen overlay for plan approval and conflict resolution
- Hotkeys:
  - `Ctrl+P` — Pause/resume focused agent
  - `Ctrl+K` — Kill focused agent
  - `Tab` — Cycle focus between panels
  - `Ctrl+C` — Graceful shutdown (merges completed work first)

## 3. Session Lifecycle

### Phase 1: INIT
```
$ triagent start "Implement auth with JWT for the API"
```
1. Load `triagent.config.yaml` from project root (or use defaults)
2. Validate config against Zod schema
3. Verify each agent CLI exists in PATH (`which {command}`)
4. Health check: two-stage verification per agent:
   - **Stage A (PATH check):** run `which {command}` — verifies binary is installed
   - **Stage B (Auth probe):** run `{auth_check}` — verifies session is active (e.g., a minimal prompt that requires auth). If no `auth_check` is configured, warn that auth cannot be verified and proceed.
5. Start Event Bus and TUI Dashboard

### Phase 2: PLAN
1. Planner decomposes the user's task into sub-tasks with domain tags
2. Scheduler maps sub-tasks to agents and builds dependency graph
3. TUI shows the proposed plan in approval gate
4. **User approves, adjusts, or rejects**

### Phase 3: SETUP
1. WorktreeManager creates one worktree per active agent (only agents with assigned tasks)
2. All worktrees branch from `HEAD` of current branch
3. Branch naming: `triagent/{agent}-{timestamp}`

### Phase 4: EXECUTE
1. Scheduler dispatches sub-tasks in rounds based on dependency graph:
   - Round N: all tasks whose dependencies are satisfied run in parallel
   - Each running task = one AgentDriver spawning its CLI process
2. TUI streams agent output in real-time
3. On task completion: `agent:done` event triggers next round evaluation
4. On task failure: `agent:error` pauses that agent, user decides retry/skip/abort
5. Auth failure detection: specific error patterns per agent trigger auth recovery flow

### Phase 5: MERGE
1. WorktreeManager merges branches sequentially (least dependent first)
2. Clean merges auto-proceed; conflicts trigger user approval gate
3. After all merges: cleanup worktrees and temporary branches
4. Final commit on base branch with session summary message

## 4. Project Structure

```
triagent/
├── package.json
├── tsconfig.json
├── triagent.config.example.yaml
│
├── src/
│   ├── cli.ts                # Entry point — Commander.js setup
│   ├── types.ts              # Shared types (events, config, task, etc.)
│   │
│   ├── core/
│   │   ├── event-bus.ts      # Typed EventEmitter wrapper
│   │   ├── planner.ts        # Task decomposition logic
│   │   ├── scheduler.ts      # Agent routing + dependency graph
│   │   └── session.ts        # Session lifecycle orchestration
│   │
│   ├── drivers/
│   │   ├── base-driver.ts    # Abstract base class for all agents
│   │   ├── claude-driver.ts  # Claude Code CLI wrapper
│   │   ├── forge-driver.ts   # ForgeCode CLI wrapper
│   │   └── codex-driver.ts   # Codex CLI wrapper
│   │
│   ├── git/
│   │   ├── worktree-mgr.ts   # Worktree create/delete/list
│   │   ├── merge.ts          # Merge execution + conflict detection
│   │   └── branch.ts         # Branch naming conventions and cleanup
│   │
│   ├── tui/
│   │   ├── app.tsx           # Ink root component
│   │   ├── agent-panel.tsx   # Individual agent output panel
│   │   ├── task-panel.tsx    # Task queue and dependency view
│   │   ├── status-bar.tsx    # Bottom bar (time, hotkeys, status)
│   │   └── approval.tsx      # Full-screen approval/conflict gate
│   │
│   └── config/
│       ├── loader.ts         # YAML file loading
│       ├── schema.ts         # Zod schema for config validation
│       └── defaults.ts       # Default agent profiles and settings
│
├── tests/
│   ├── core/                 # Unit tests for planner, scheduler, etc.
│   ├── drivers/              # Driver tests with mock processes
│   ├── git/                  # Worktree/merge tests with temp repos
│   └── fixtures/             # Sample agent outputs for parsing tests
│
└── docs/
    └── architecture.md       # This document (or link to it)
```

## 5. Configuration Schema

File: `triagent.config.yaml` at project root.

```yaml
agents:
  claude:
    command: claude                    # CLI binary name
    args:                             # Fixed CLI flags (task prompt appended as last arg)
      - "--dangerously-skip-permissions"
      - "-p"
    strengths:                         # Domains this agent handles well
      - frontend
      - design
      - planning
    max_concurrent: 1                  # Max parallel tasks for this agent
    health_check: "claude --version"   # Binary presence check
    auth_check: "claude -p 'respond OK' --max-turns 1"  # Auth session verification

  forge:
    command: forge
    args:
      - "--dangerously-skip-permissions"
      - "-p"
    strengths:
      - backend
      - architecture
      - refactoring
    max_concurrent: 1
    health_check: "forge --version"
    auth_check: "forge -p 'respond OK' --max-turns 1"

  codex:
    command: codex
    args:
      - "--dangerously-skip-permissions"
      - "-p"
    strengths:
      - testing
      - docs
      - ci-cd
      - apis
      - config
    max_concurrent: 1
    health_check: "codex --version"
    auth_check: "codex -p 'respond OK' --max-turns 1"

git:
  worktree_dir: .triagent/worktrees   # Where worktrees are created
  branch_prefix: triagent/            # Prefix for temporary branches
  auto_merge: true                    # Auto-merge clean results
  merge_strategy: sequential          # sequential | manual

session:
  require_approval: true              # User must approve plan before execution
  log_dir: .triagent/logs             # Session logs (event replay)
  max_retries: 2                      # Retries per failed sub-task
  tui_refresh_ms: 100                 # TUI output debounce interval

# Optional: explicit path-to-agent mapping (overrides strength-based routing)
domains:
  "src/frontend/**": claude
  "src/api/**": forge
  "tests/**": codex
  ".github/**": codex
```

## 6. Type Definitions

```typescript
// Core event types
type TriAgentEvent =
  | { type: 'task:created'; task: SubTask }
  | { type: 'task:assigned'; task: SubTask; agent: AgentName }
  | { type: 'task:started'; taskId: string; agent: AgentName }
  | { type: 'task:completed'; taskId: string; agent: AgentName }
  | { type: 'task:failed'; taskId: string; agent: AgentName; error: string }
  | { type: 'agent:output'; agent: AgentName; line: string }
  | { type: 'agent:status'; agent: AgentName; status: AgentStatus }
  | { type: 'agent:error'; agent: AgentName; error: string; isAuthError: boolean }
  | { type: 'git:worktree:created'; agent: AgentName; path: string; branch: string }
  | { type: 'git:merge:start'; agent: AgentName }
  | { type: 'git:merge:success'; agent: AgentName }
  | { type: 'git:merge:conflict'; agent: AgentName; files: string[] }
  | { type: 'session:phase'; phase: SessionPhase };

type AgentName = string;  // Known values: 'claude' | 'forge' | 'codex'. Extensible for custom agents.
type AgentStatus = 'idle' | 'working' | 'paused' | 'error' | 'done';
type SessionPhase = 'init' | 'plan' | 'setup' | 'execute' | 'merge' | 'complete';

interface SubTask {
  id: string;
  description: string;          // Natural language task for the agent
  domain: string;               // e.g., 'frontend', 'backend', 'testing'
  targetPaths?: string[];       // File/dir paths this task will likely touch (for path-based routing)
  dependsOn: string[];          // IDs of tasks that must complete first
  assignedTo?: AgentName;
  status: 'pending' | 'running' | 'done' | 'failed';
}

interface AgentConfig {
  command: string;
  args: string[];               // Fixed CLI args (excluding task prompt). e.g., ['--dangerously-skip-permissions', '-p']
  strengths: string[];
  max_concurrent: number;
  health_check: string;         // PATH/binary verification command
  auth_check?: string;          // Auth session verification command (minimal prompt)
}

interface TriAgentConfig {
  agents: Record<string, AgentConfig>;
  git: {
    worktree_dir: string;
    branch_prefix: string;
    auto_merge: boolean;
    merge_strategy: 'sequential' | 'manual';
  };
  session: {
    require_approval: boolean;
    log_dir: string;
    max_retries: number;
    tui_refresh_ms: number;       // TUI output debounce interval (default: 100)
  };
  domains?: Record<string, string>;  // glob pattern → agent name
}
```

## 7. Risks and Mitigations

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | **Agent output parsing is unreliable** — each agent has different output formats, making progress detection fragile | Cannot determine task completion accurately | High | Use process exit code as primary completion signal. Output parsing is best-effort for TUI display only. Don't depend on parsing for orchestration logic. |
| 2 | **Auth session expires mid-session** — Claude Max or ChatGPT Team token expires while an agent is working | Agent fails, work may be lost | Medium | Detect auth error patterns per agent (configurable regex). Pause only the affected agent. Completed work is preserved in the worktree. User re-auths and resumes. |
| 3 | **Merge conflicts between worktrees** — two agents modify related files (e.g., shared types, imports) | Manual intervention required, breaks flow | Medium | The `domains` config reduces overlap. Planner should avoid assigning tasks that touch the same files. For MVP, conflicts escalate to user. Future: AI-assisted merge. |
| 4 | **Agent CLI flags change between versions** — `--dangerously-skip-permissions` or `-p` may change | Agent spawn fails | Medium | `args_template` in config makes flags user-configurable. Health check validates invocation at startup. |
| 5 | **node-pty compilation fails on Apple Silicon** — native module compilation issues | Cannot spawn agents | Low | Fallback to `child_process.spawn` with raw stdio (loses terminal emulation but still functional). Document prebuild availability. |
| 6 | **Planner decomposes poorly** — heuristic-based decomposition produces bad task splits | Wrong agent gets wrong task, wasted time | Medium | The approval gate (Phase 2) is the primary mitigation. User sees and adjusts the plan before execution. Keep the Planner simple and transparent. |
| 7 | **Agents conflict on shared resources** — lock files, ports, database connections | Race conditions, agent failures | Low | Each agent runs in its own worktree (filesystem isolation). Document that agents sharing external resources (DBs, ports) need coordination beyond TriAgent's scope. |
| 8 | **TUI performance with heavy output** — agents produce lots of stdout, TUI becomes sluggish | Poor user experience | Medium | Drivers buffer in circular buffer (500 lines), flush to Event Bus every `tui_refresh_ms` (100ms default). TUI subscribes to debounced render events. Full logs in `log_dir`. |
| 9 | **Filesystem writes outside worktree** — `--dangerously-skip-permissions` lets agents write anywhere the user's shell can reach, not just their worktree | Unintended file modifications across 3 concurrent agents | Low-Medium | Document prominently. Agents are prompted to only modify their worktree. Future: `--allowed-dir` flag if CLIs support it. |
| 10 | **TriAgent crashes mid-session** — Node process dies, terminal closes, machine sleeps | Worktrees remain on disk, in-memory state lost | Medium | MVP: no automatic resume. Worktrees persist on disk and can be merged manually. `triagent cleanup` removes orphaned worktrees. Session state is logged to `log_dir` for post-mortem. Future: `triagent resume` using persisted session state. |

## 8. Testing Strategy

- **Unit tests:** Core modules (Planner, Scheduler, EventBus) with mock data — no real agents needed
- **Driver tests:** Mock `node-pty` to simulate agent output patterns and exit codes
- **Git tests:** Create temporary Git repos in `/tmp`, test worktree creation/merge/conflict detection
- **Integration tests:** End-to-end with simple shell scripts posing as agents (`echo "done" && exit 0`)
- **Manual testing:** Full sessions with real agents on a sample project

## 9. CLI Interface

```bash
# Start a session with a task
triagent start "Implement user authentication with JWT"

# Start with explicit config file
triagent start -c ./custom-config.yaml "Add dark mode support"

# Check agent availability and auth status
triagent status

# Initialize default config in current project
triagent init

# View session logs
triagent logs [session-id]

# Clean up orphaned worktrees from crashed sessions
triagent cleanup

# Version
triagent --version
```

## 10. .gitignore Additions

Projects using TriAgent should add:
```
.triagent/
```

This covers worktrees, logs, and any runtime state.

## 11. NPM Distribution

```bash
# Install globally
npm install -g triagent

# Or run via npx
npx triagent start "My task"
```

Binary name: `triagent` (registered via `bin` field in package.json).
