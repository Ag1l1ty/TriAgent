# TriAgent

CLI orchestrator that coordinates 3 AI coding agents (Claude Code, ForgeCode, Codex CLI) from a single terminal. Think of it as an intelligent tmux that assigns tasks based on configurable agent strengths, coordinates via Git worktrees, and monitors in real-time via a TUI dashboard.

**Zero API cost** — agents authenticate via existing subscriptions (Claude Code Max, ChatGPT Team, etc.).

## Authentication Model

TriAgent is designed for account-based agent CLIs.

- Claude Code, Codex CLI, ForgeCode, and similar tools should run with the user's existing logged-in account or subscription.
- TriAgent should not require OpenAI, Anthropic, or other provider API keys for normal operation.
- Any auth checks should validate CLI session/account access, not raw API key presence.

## Quick Start

```bash
# Install dependencies
npm install

# Check that your agents are available
npx tsx src/cli.ts status

# Initialize config in your project
npx tsx src/cli.ts init

# Start a session
npx tsx src/cli.ts start "Implement user auth with JWT"
```

## Install

Local development:

```bash
npm install
npm run build
node dist/cli.js status
```

Published package:

```bash
npm install -g triagent
triagent status
```

## Commands

| Command | Description |
|---------|-------------|
| `triagent start <task>` | Plan, approve, and execute a task across agents |
| `triagent status` | Check agent PATH, health, and auth checks |
| `triagent doctor` | Run repository, session, and agent diagnostics |
| `triagent init` | Copy example config to `triagent.config.yaml` |
| `triagent logs [id]` | Show session snapshot and recent events |
| `triagent cleanup` | Remove TriAgent worktrees and prune stale Git worktrees |

## How It Works

```
User Task
    |
    v
[Planner] -- keyword-based decomposition --> SubTasks
    |
    v
[Scheduler] -- strength/path routing --> Assigned SubTasks
    |
    v
[Approval Gate] -- user reviews plan --> Approved
    |
    v
[WorktreeManager] -- one worktree per agent --> Isolated branches
    |
    v
[Agent Drivers] -- node-pty spawn --> Parallel execution
    |
    v
[Merge] -- sequential merge --> Done
```

### 5-Phase Session Lifecycle

1. **INIT** — Load config, verify agent health (PATH + auth check)
2. **PLAN** — Decompose task into subtasks, assign agents
3. **SETUP** — Create Git worktrees (one per agent)
4. **EXECUTE** — Dispatch tasks in dependency rounds
5. **MERGE** — Sequential merge of agent branches

## Architecture

```
src/
  cli.ts                 # Commander.js entry point (5 commands)
  index.ts               # Version export
  types.ts               # Shared types (events, config, tasks)
  config/
    schema.ts            # Zod v4 validation schema
    defaults.ts          # Default agent configurations
    loader.ts            # YAML config loader with fallback
  core/
    event-bus.ts         # Typed EventEmitter (13 event types)
    planner.ts           # Heuristic task decomposition
    scheduler.ts         # Agent routing + dependency graph
    session.ts           # 5-phase orchestrator
  drivers/
    base-driver.ts       # node-pty + child_process fallback
    claude-driver.ts     # Claude Code factory
    forge-driver.ts      # ForgeCode factory
    codex-driver.ts      # Codex CLI factory
  git/
    branch.ts            # Branch naming utilities
    worktree-mgr.ts      # Git worktree lifecycle
    merge.ts             # Merge with conflict detection
  tui/
    app.tsx              # Root Ink layout
    agent-panel.tsx      # Agent output + status panel
    task-panel.tsx       # Task queue with status icons
    status-bar.tsx       # Phase, agents, hotkeys
    approval.tsx         # Plan approval overlay
```

## Configuration

Create `triagent.config.yaml` in your project root (or run `triagent init`):

```yaml
agents:
  claude:
    command: claude
    args: ["--dangerously-skip-permissions", "-p"]
    strengths: [frontend, design, planning]
    max_concurrent: 1
    health_check:
      command: claude
      args: ["--version"]

  forge:
    command: forge
    args: ["--dangerously-skip-permissions", "-p"]
    strengths: [backend, architecture, refactoring]
    max_concurrent: 1
    health_check:
      command: forge
      args: ["--version"]

  codex:
    command: codex
    args: ["--dangerously-skip-permissions", "-p"]
    strengths: [testing, docs, ci-cd, apis, config]
    max_concurrent: 1
    health_check:
      command: codex
      args: ["--version"]

git:
  worktree_dir: .triagent/worktrees
  branch_prefix: triagent/
  auto_merge: true
  merge_strategy: sequential  # or 'manual'

session:
  require_approval: true
  log_dir: .triagent/logs
  state_dir: .triagent/sessions
  max_retries: 2
  task_timeout_ms: 300000
  tui_refresh_ms: 100

# Optional: explicit path-to-agent mapping (overrides strength-based routing)
# domains:
#   "src/frontend/**": claude
#   "src/api/**": forge
#   "tests/**": codex
```

### Agent Routing Precedence

1. **Path-based** — `domains` glob patterns match against `targetPaths`
2. **Strength-based** — Agent `strengths` match against task `domain`
3. **Fallback** — First configured agent

## Task Decomposition

The Planner uses keyword-based heuristics (no LLM calls) to classify tasks into domains:

| Domain | Keywords |
|--------|----------|
| frontend | react, component, ui, css, page, form, dashboard... |
| backend | api, endpoint, route, database, auth, jwt, server... |
| testing | test, spec, e2e, coverage, mock, vitest, jest... |
| ci-cd | ci, pipeline, github actions, deploy, docker... |
| docs | readme, documentation, changelog, guide... |
| config | config, env, setup, install, scaffold... |

Tasks are split by conjunctions ("and", "with", "plus") and auto-classified. A testing subtask is added automatically when missing.

## Agent Drivers

Agents are spawned via **node-pty** (TTY-based, agents detect interactive mode) with automatic fallback to **child_process.spawn** if node-pty is unavailable.

Features:
- Circular output buffer (500 lines max)
- Periodic flush at configurable interval (`tui_refresh_ms`)
- Auth error detection (regex patterns)
- Per-task timeout (`task_timeout_ms`)
- Process lifecycle: start, pause (SIGSTOP), resume (SIGCONT), kill (SIGTERM)

## Event System

13 typed events via discriminated union:

| Event | Description |
|-------|-------------|
| `task:created` | New subtask decomposed |
| `task:assigned` | Agent assigned to subtask |
| `task:started` | Agent begins work |
| `task:completed` | Agent finishes successfully |
| `task:failed` | Agent fails with error |
| `agent:output` | Buffered stdout lines |
| `agent:status` | Status change (idle/working/paused/error/done) |
| `agent:error` | Error with `isAuthError` flag |
| `git:worktree:created` | Worktree ready |
| `git:merge:start` | Merge initiated |
| `git:merge:success` | Clean merge |
| `git:merge:conflict` | Conflict files listed |
| `session:phase` | Phase transition |

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run lint

# Build
npm run build

# Dev mode
npm run dev
```

## Publishing

TriAgent is a Node CLI package. It does not need Vercel.

Recommended release flow:

```bash
npm run lint
npm test
npm run build
npm pack --dry-run
npm publish
```

Recommended distribution:

- GitHub for source code, issues, releases, and visibility
- npm for installation and updates

Vercel only makes sense if you later build a separate web UI or docs site.

## GitHub Release Flow

This repo includes GitHub Actions for:

- CI on pushes and pull requests
- Packaging on tags
- Publishing to npm on `v*` tags when `NPM_TOKEN` is configured in GitHub Actions secrets
- Attaching the generated `.tgz` package to a GitHub Release

## Tech Stack

- **TypeScript 5.x** — Strict mode, NodeNext modules
- **Node.js 22+** — ES2022 target
- **Commander.js 14** — CLI framework
- **Ink 6** — React for terminal (TUI)
- **node-pty** — PTY-based process spawn
- **simple-git** — Git operations
- **Zod 4** — Config validation
- **eventemitter3** — Typed event bus
- **Vitest 4** — Test runner

## License

MIT
