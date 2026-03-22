# TriAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI orchestrator that coordinates Claude Code, ForgeCode, and Codex CLI from a single terminal with real-time TUI dashboard.

**Architecture:** Event-Driven Orchestrator — 6 components (EventBus, Planner, Scheduler, AgentDrivers, WorktreeManager, TUI) communicate via typed events. Git worktrees isolate each agent's work.

**Tech Stack:** TypeScript 5.x, Node.js 24+, Commander.js, Ink 5, node-pty, simple-git, Zod, eventemitter3, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-triagent-design.md`

---

## File Map

| File | Responsibility | Created in Task |
|------|---------------|-----------------|
| `package.json` | Dependencies, scripts, bin entry | 1 |
| `tsconfig.json` | TypeScript config (strict, ESM) | 1 |
| `triagent.config.example.yaml` | Example config file | 1 |
| `.gitignore` | Ignore patterns | 1 |
| `src/types.ts` | All shared types: events, config, tasks, agents | 2 |
| `src/config/schema.ts` | Zod validation schema for config | 3 |
| `src/config/defaults.ts` | Default agent profiles | 3 |
| `src/config/loader.ts` | YAML file loading + validation | 3 |
| `src/core/event-bus.ts` | Typed EventEmitter wrapper with logging | 4 |
| `src/git/branch.ts` | Branch naming conventions | 5 |
| `src/git/worktree-mgr.ts` | Worktree create/delete/list | 5 |
| `src/git/merge.ts` | Merge execution + conflict detection | 5 |
| `src/drivers/base-driver.ts` | Abstract driver class with lifecycle | 6 |
| `src/drivers/claude-driver.ts` | Claude Code CLI wrapper | 6 |
| `src/drivers/forge-driver.ts` | ForgeCode CLI wrapper | 6 |
| `src/drivers/codex-driver.ts` | Codex CLI wrapper | 6 |
| `src/core/planner.ts` | Heuristic task decomposition | 7 |
| `src/core/scheduler.ts` | Agent routing + dependency graph | 8 |
| `vitest.config.ts` | Vitest configuration for ESM | 1 |
| `src/core/session.ts` | Session lifecycle orchestrator | 9 |
| `src/tui/app.tsx` | Ink root component | 10 |
| `src/tui/agent-panel.tsx` | Per-agent output panel | 10 |
| `src/tui/task-panel.tsx` | Task queue display | 10 |
| `src/tui/status-bar.tsx` | Bottom status bar | 10 |
| `src/tui/approval.tsx` | Approval gate overlay | 10 |
| `src/cli.ts` | CLI entry point (Commander.js) | 11 |
| `tests/fixtures/mock-agent.sh` | Shell script mock agent | 12 |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `triagent.config.example.yaml`
- Create: `src/index.ts` (placeholder)

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/agilitychanges/Desktop/Claude_Code/TriAgent
npm init -y
```

Then update `package.json`:

```json
{
  "name": "triagent",
  "version": "0.1.0",
  "description": "CLI orchestrator for AI coding agents",
  "type": "module",
  "bin": {
    "triagent": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install commander ink ink-spinner react eventemitter3 simple-git yaml zod node-pty minimatch
npm install -D typescript @types/node @types/react vitest tsx @inkjs/ui ink-testing-library @types/minimatch
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.triagent/
*.tsbuildinfo
```

- [ ] **Step 5: Create example config**

Create `triagent.config.example.yaml` with the full config from the spec (Section 5).

- [ ] **Step 6: Create placeholder entry**

Create `src/index.ts`:

```typescript
export const VERSION = '0.1.0';
```

- [ ] **Step 7: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 8: Verify build**

```bash
npx tsc --noEmit
```

Expected: Clean, no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore triagent.config.example.yaml src/index.ts
git commit -m "chore: scaffold TriAgent project with dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`
- Test: `tests/types.test.ts`

- [ ] **Step 1: Write type validation test**

Create `tests/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  TriAgentEvent,
  AgentName,
  AgentStatus,
  SessionPhase,
  SubTask,
  AgentConfig,
  TriAgentConfig,
} from '../src/types.js';

describe('types', () => {
  it('SubTask should have required fields', () => {
    const task: SubTask = {
      id: 'task-1',
      description: 'Implement login form',
      domain: 'frontend',
      dependsOn: [],
      status: 'pending',
    };
    expect(task.id).toBe('task-1');
    expect(task.assignedTo).toBeUndefined();
    expect(task.targetPaths).toBeUndefined();
  });

  it('SubTask should accept optional fields', () => {
    const task: SubTask = {
      id: 'task-2',
      description: 'Write tests',
      domain: 'testing',
      targetPaths: ['tests/auth.test.ts'],
      dependsOn: ['task-1'],
      assignedTo: 'codex',
      status: 'running',
    };
    expect(task.targetPaths).toEqual(['tests/auth.test.ts']);
    expect(task.assignedTo).toBe('codex');
  });

  it('TriAgentEvent discriminated union should work', () => {
    const event: TriAgentEvent = {
      type: 'task:created',
      task: {
        id: 'task-1',
        description: 'Test',
        domain: 'backend',
        dependsOn: [],
        status: 'pending',
      },
    };
    expect(event.type).toBe('task:created');
    if (event.type === 'task:created') {
      expect(event.task.domain).toBe('backend');
    }
  });

  it('AgentConfig should require args as array and structured health checks', () => {
    const config: AgentConfig = {
      command: 'claude',
      args: ['--dangerously-skip-permissions', '-p'],
      strengths: ['frontend', 'design'],
      max_concurrent: 1,
      health_check: { command: 'claude', args: ['--version'] },
    };
    expect(Array.isArray(config.args)).toBe(true);
    expect(config.health_check.command).toBe('claude');
    expect(config.auth_check).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/types.test.ts
```

Expected: FAIL — cannot resolve `../src/types.js`

- [ ] **Step 3: Write types.ts**

Create `src/types.ts` with all types from spec Section 6:

```typescript
// Agent identification
export type AgentName = string; // Known values: 'claude' | 'forge' | 'codex'
export type AgentStatus = 'idle' | 'working' | 'paused' | 'error' | 'done';
export type SessionPhase = 'init' | 'plan' | 'setup' | 'execute' | 'merge' | 'complete';

// Sub-task
export interface SubTask {
  id: string;
  description: string;
  domain: string;
  targetPaths?: string[];
  dependsOn: string[];
  assignedTo?: AgentName;
  status: 'pending' | 'running' | 'done' | 'failed';
}

// Config interfaces
export interface HealthCheck {
  command: string;
  args: string[];
}

export interface AgentConfig {
  command: string;
  args: string[];
  strengths: string[];
  max_concurrent: number;
  health_check: HealthCheck;       // Structured to prevent shell injection
  auth_check?: HealthCheck;        // Structured to prevent shell injection
}

export interface TriAgentConfig {
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
    tui_refresh_ms: number;
  };
  domains?: Record<string, string>;
}

// Event system
export type TriAgentEvent =
  | { type: 'task:created'; task: SubTask }
  | { type: 'task:assigned'; task: SubTask; agent: AgentName }
  | { type: 'task:started'; taskId: string; agent: AgentName }
  | { type: 'task:completed'; taskId: string; agent: AgentName }
  | { type: 'task:failed'; taskId: string; agent: AgentName; error: string }
  | { type: 'agent:output'; agent: AgentName; lines: string[] } // NOTE: spec says `line: string`, changed to `lines: string[]` for buffered flush (circular buffer design)
  | { type: 'agent:status'; agent: AgentName; status: AgentStatus }
  | { type: 'agent:error'; agent: AgentName; error: string; isAuthError: boolean }
  | { type: 'git:worktree:created'; agent: AgentName; path: string; branch: string }
  | { type: 'git:merge:start'; agent: AgentName }
  | { type: 'git:merge:success'; agent: AgentName }
  | { type: 'git:merge:conflict'; agent: AgentName; files: string[] }
  | { type: 'session:phase'; phase: SessionPhase };

// Utility: extract event by type
export type EventOfType<T extends TriAgentEvent['type']> = Extract<TriAgentEvent, { type: T }>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/types.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add shared type definitions for events, config, and tasks"
```

---

## Task 3: Config Module

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/defaults.ts`
- Create: `src/config/loader.ts`
- Test: `tests/config/schema.test.ts`
- Test: `tests/config/loader.test.ts`

- [ ] **Step 1: Write schema validation tests**

Create `tests/config/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/schema.js';

describe('configSchema', () => {
  it('should validate a complete valid config', () => {
    const valid = {
      agents: {
        claude: {
          command: 'claude',
          args: ['--dangerously-skip-permissions', '-p'],
          strengths: ['frontend', 'design'],
          max_concurrent: 1,
          health_check: { command: 'claude', args: ['--version'] },
          auth_check: { command: 'claude', args: ['-p', 'respond OK', '--max-turns', '1'] },
        },
      },
      git: {
        worktree_dir: '.triagent/worktrees',
        branch_prefix: 'triagent/',
        auto_merge: true,
        merge_strategy: 'sequential',
      },
      session: {
        require_approval: true,
        log_dir: '.triagent/logs',
        max_retries: 2,
        tui_refresh_ms: 100,
      },
    };
    const result = configSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject config with empty agents', () => {
    const invalid = {
      agents: {},
      git: {
        worktree_dir: '.triagent/worktrees',
        branch_prefix: 'triagent/',
        auto_merge: true,
        merge_strategy: 'sequential',
      },
      session: {
        require_approval: true,
        log_dir: '.triagent/logs',
        max_retries: 2,
        tui_refresh_ms: 100,
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid merge_strategy', () => {
    const invalid = {
      agents: {
        claude: {
          command: 'claude',
          args: ['-p'],
          strengths: ['frontend'],
          max_concurrent: 1,
          health_check: { command: 'claude', args: ['--version'] },
        },
      },
      git: {
        worktree_dir: '.triagent/worktrees',
        branch_prefix: 'triagent/',
        auto_merge: true,
        merge_strategy: 'invalid',
      },
      session: {
        require_approval: true,
        log_dir: '.triagent/logs',
        max_retries: 2,
        tui_refresh_ms: 100,
      },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept config with optional domains', () => {
    const withDomains = {
      agents: {
        claude: {
          command: 'claude',
          args: ['-p'],
          strengths: ['frontend'],
          max_concurrent: 1,
          health_check: { command: 'claude', args: ['--version'] },
        },
      },
      git: {
        worktree_dir: '.triagent/worktrees',
        branch_prefix: 'triagent/',
        auto_merge: true,
        merge_strategy: 'sequential',
      },
      session: {
        require_approval: true,
        log_dir: '.triagent/logs',
        max_retries: 2,
        tui_refresh_ms: 100,
      },
      domains: {
        'src/frontend/**': 'claude',
      },
    };
    const result = configSchema.safeParse(withDomains);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/config/schema.test.ts
```

Expected: FAIL — cannot resolve `../../src/config/schema.js`

- [ ] **Step 3: Implement schema.ts**

Create `src/config/schema.ts`:

```typescript
import { z } from 'zod';

const healthCheckSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
});

const agentConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).min(1),
  strengths: z.array(z.string()).min(1),
  max_concurrent: z.number().int().positive().default(1),
  health_check: healthCheckSchema,
  auth_check: healthCheckSchema.optional(),
});

export const configSchema = z.object({
  agents: z.record(z.string(), agentConfigSchema).refine(
    (agents) => Object.keys(agents).length > 0,
    { message: 'At least one agent must be configured' }
  ),
  git: z.object({
    worktree_dir: z.string().default('.triagent/worktrees'),
    branch_prefix: z.string().default('triagent/'),
    auto_merge: z.boolean().default(true),
    merge_strategy: z.enum(['sequential', 'manual']).default('sequential'),
  }),
  session: z.object({
    require_approval: z.boolean().default(true),
    log_dir: z.string().default('.triagent/logs'),
    max_retries: z.number().int().nonnegative().default(2),
    tui_refresh_ms: z.number().int().positive().default(100),
  }),
  domains: z.record(z.string(), z.string()).optional(),
});

export type ValidatedConfig = z.infer<typeof configSchema>;
```

- [ ] **Step 4: Run schema tests**

```bash
npx vitest run tests/config/schema.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Write defaults.ts**

Create `src/config/defaults.ts`:

```typescript
import type { TriAgentConfig } from '../types.js';

export const DEFAULT_CONFIG: TriAgentConfig = {
  agents: {
    claude: {
      command: 'claude',
      args: ['--dangerously-skip-permissions', '-p'],
      strengths: ['frontend', 'design', 'planning'],
      max_concurrent: 1,
      health_check: { command: 'claude', args: ['--version'] },
      auth_check: { command: 'claude', args: ['-p', 'respond OK', '--max-turns', '1'] },
    },
    forge: {
      command: 'forge',
      args: ['--dangerously-skip-permissions', '-p'],
      strengths: ['backend', 'architecture', 'refactoring'],
      max_concurrent: 1,
      health_check: { command: 'forge', args: ['--version'] },
      auth_check: { command: 'forge', args: ['-p', 'respond OK', '--max-turns', '1'] },
    },
    codex: {
      command: 'codex',
      args: ['--dangerously-skip-permissions', '-p'],
      strengths: ['testing', 'docs', 'ci-cd', 'apis', 'config'],
      max_concurrent: 1,
      health_check: { command: 'codex', args: ['--version'] },
      auth_check: { command: 'codex', args: ['-p', 'respond OK', '--max-turns', '1'] },
    },
  },
  git: {
    worktree_dir: '.triagent/worktrees',
    branch_prefix: 'triagent/',
    auto_merge: true,
    merge_strategy: 'sequential',
  },
  session: {
    require_approval: true,
    log_dir: '.triagent/logs',
    max_retries: 2,
    tui_refresh_ms: 100,
  },
};
```

- [ ] **Step 6: Write loader tests**

Create `tests/config/loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  const tmpDir = join(tmpdir(), 'triagent-test-config');

  function setup() {
    mkdirSync(tmpDir, { recursive: true });
  }

  function cleanup() {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  it('should return defaults when no config file exists', async () => {
    setup();
    const config = await loadConfig(join(tmpDir, 'nonexistent.yaml'));
    expect(config.agents.claude).toBeDefined();
    expect(config.agents.forge).toBeDefined();
    expect(config.agents.codex).toBeDefined();
    cleanup();
  });

  it('should load and validate a YAML config file', async () => {
    setup();
    const configPath = join(tmpDir, 'triagent.config.yaml');
    writeFileSync(configPath, `
agents:
  claude:
    command: claude
    args:
      - "-p"
    strengths:
      - frontend
    max_concurrent: 1
    health_check: "claude --version"
git:
  worktree_dir: .triagent/worktrees
  branch_prefix: triagent/
  auto_merge: true
  merge_strategy: sequential
session:
  require_approval: true
  log_dir: .triagent/logs
  max_retries: 2
  tui_refresh_ms: 100
`);
    const config = await loadConfig(configPath);
    expect(Object.keys(config.agents)).toEqual(['claude']);
    expect(config.agents.claude.strengths).toEqual(['frontend']);
    cleanup();
  });

  it('should throw on invalid config', async () => {
    setup();
    const configPath = join(tmpDir, 'bad.yaml');
    writeFileSync(configPath, `
agents: {}
git:
  merge_strategy: invalid
`);
    await expect(loadConfig(configPath)).rejects.toThrow();
    cleanup();
  });
});
```

- [ ] **Step 7: Implement loader.ts**

Create `src/config/loader.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import YAML from 'yaml';
import { configSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { TriAgentConfig } from '../types.js';

export async function loadConfig(configPath: string): Promise<TriAgentConfig> {
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = await readFile(configPath, 'utf-8');
  const parsed = YAML.parse(raw);
  const validated = configSchema.parse(parsed);
  return validated as TriAgentConfig;
}
```

- [ ] **Step 8: Run all config tests**

```bash
npx vitest run tests/config/
```

Expected: PASS (7 tests)

- [ ] **Step 9: Commit**

```bash
git add src/config/ tests/config/
git commit -m "feat: add config module with Zod schema, defaults, and YAML loader"
```

---

## Task 4: Event Bus

**Files:**
- Create: `src/core/event-bus.ts`
- Test: `tests/core/event-bus.test.ts`

- [ ] **Step 1: Write event bus tests**

Create `tests/core/event-bus.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import type { SubTask } from '../../src/types.js';

describe('TriAgentEventBus', () => {
  it('should emit and receive typed events', () => {
    const bus = new TriAgentEventBus();
    const handler = vi.fn();

    bus.on('task:created', handler);
    const task: SubTask = {
      id: 't1',
      description: 'Test task',
      domain: 'backend',
      dependsOn: [],
      status: 'pending',
    };
    bus.emit('task:created', { type: 'task:created', task });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: 'task:created', task });
  });

  it('should log events when logging is enabled', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const task: SubTask = {
      id: 't1',
      description: 'Test',
      domain: 'frontend',
      dependsOn: [],
      status: 'pending',
    };

    bus.emit('task:created', { type: 'task:created', task });
    bus.emit('session:phase', { type: 'session:phase', phase: 'init' });

    const log = bus.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].event.type).toBe('task:created');
    expect(log[1].event.type).toBe('session:phase');
  });

  it('should not log events when logging is disabled', () => {
    const bus = new TriAgentEventBus({ logging: false });
    bus.emit('session:phase', { type: 'session:phase', phase: 'init' });
    expect(bus.getEventLog()).toHaveLength(0);
  });

  it('should support removeAllListeners', () => {
    const bus = new TriAgentEventBus();
    const handler = vi.fn();
    bus.on('agent:status', handler);
    bus.removeAllListeners();
    bus.emit('agent:status', { type: 'agent:status', agent: 'claude', status: 'idle' });
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/core/event-bus.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement event-bus.ts**

Create `src/core/event-bus.ts`:

```typescript
import EventEmitter from 'eventemitter3';
import type { TriAgentEvent } from '../types.js';

interface EventLogEntry {
  timestamp: number;
  event: TriAgentEvent;
}

interface EventBusOptions {
  logging?: boolean;
}

export class TriAgentEventBus {
  private emitter = new EventEmitter();
  private log: EventLogEntry[] = [];
  private logging: boolean;

  constructor(options: EventBusOptions = {}) {
    this.logging = options.logging ?? false;
  }

  on<T extends TriAgentEvent['type']>(
    eventType: T,
    handler: (event: Extract<TriAgentEvent, { type: T }>) => void
  ): void {
    this.emitter.on(eventType, handler);
  }

  off<T extends TriAgentEvent['type']>(
    eventType: T,
    handler: (event: Extract<TriAgentEvent, { type: T }>) => void
  ): void {
    this.emitter.off(eventType, handler);
  }

  emit<T extends TriAgentEvent['type']>(
    eventType: T,
    event: Extract<TriAgentEvent, { type: T }>
  ): void {
    if (this.logging) {
      this.log.push({ timestamp: Date.now(), event });
    }
    this.emitter.emit(eventType, event);
  }

  getEventLog(): ReadonlyArray<EventLogEntry> {
    return this.log;
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/core/event-bus.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/event-bus.ts tests/core/event-bus.test.ts
git commit -m "feat: add typed event bus with optional logging"
```

---

## Task 5: Git Module (Worktree + Branch + Merge)

**Files:**
- Create: `src/git/branch.ts`
- Create: `src/git/worktree-mgr.ts`
- Create: `src/git/merge.ts`
- Test: `tests/git/branch.test.ts`
- Test: `tests/git/worktree-mgr.test.ts`
- Test: `tests/git/merge.test.ts`

- [ ] **Step 1: Write branch naming tests**

Create `tests/git/branch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { makeBranchName, isTriAgentBranch } from '../../src/git/branch.js';

describe('branch', () => {
  it('should create branch name with prefix and agent', () => {
    const name = makeBranchName('triagent/', 'claude', 'abc123');
    expect(name).toBe('triagent/claude-abc123');
  });

  it('should detect triagent branches', () => {
    expect(isTriAgentBranch('triagent/claude-abc123', 'triagent/')).toBe(true);
    expect(isTriAgentBranch('main', 'triagent/')).toBe(false);
    expect(isTriAgentBranch('feature/login', 'triagent/')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/git/branch.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement branch.ts**

Create `src/git/branch.ts`:

```typescript
export function makeBranchName(prefix: string, agent: string, sessionId: string): string {
  return `${prefix}${agent}-${sessionId}`;
}

export function isTriAgentBranch(branchName: string, prefix: string): boolean {
  return branchName.startsWith(prefix);
}
```

- [ ] **Step 4: Run branch tests**

```bash
npx vitest run tests/git/branch.test.ts
```

Expected: PASS

- [ ] **Step 5: Write worktree manager tests**

Create `tests/git/worktree-mgr.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorktreeManager } from '../../src/git/worktree-mgr.js';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('WorktreeManager', () => {
  const baseDir = join(tmpdir(), `triagent-wt-test-${Date.now()}`);
  let mgr: WorktreeManager;

  beforeEach(() => {
    mkdirSync(baseDir, { recursive: true });
    execSync('git init', { cwd: baseDir });
    execSync('git config user.email "test@test.com"', { cwd: baseDir });
    execSync('git config user.name "Test"', { cwd: baseDir });
    execSync('touch initial.txt', { cwd: baseDir });
    execSync('git add . && git commit -m "initial"', { cwd: baseDir });

    mgr = new WorktreeManager({
      repoDir: baseDir,
      worktreeDir: join(baseDir, '.triagent/worktrees'),
      branchPrefix: 'triagent/',
    });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('should create a worktree for an agent', async () => {
    const result = await mgr.create('claude', 'session1');
    expect(existsSync(result.path)).toBe(true);
    expect(result.branch).toBe('triagent/claude-session1');
  });

  it('should list active worktrees', async () => {
    await mgr.create('claude', 'session1');
    await mgr.create('forge', 'session1');
    const trees = await mgr.list();
    expect(trees.length).toBeGreaterThanOrEqual(2);
  });

  it('should remove a worktree', async () => {
    const result = await mgr.create('codex', 'session1');
    await mgr.remove('codex', 'session1');
    expect(existsSync(result.path)).toBe(false);
  });
});
```

- [ ] **Step 6: Implement worktree-mgr.ts**

Create `src/git/worktree-mgr.ts`:

```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import { join } from 'node:path';
import { makeBranchName } from './branch.js';

interface WorktreeManagerOptions {
  repoDir: string;
  worktreeDir: string;
  branchPrefix: string;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  agent: string;
}

export class WorktreeManager {
  private git: SimpleGit;
  private worktreeDir: string;
  private branchPrefix: string;

  constructor(options: WorktreeManagerOptions) {
    this.git = simpleGit(options.repoDir);
    this.worktreeDir = options.worktreeDir;
    this.branchPrefix = options.branchPrefix;
  }

  async create(agent: string, sessionId: string): Promise<WorktreeInfo> {
    const branch = makeBranchName(this.branchPrefix, agent, sessionId);
    const path = join(this.worktreeDir, agent);

    await this.git.raw(['worktree', 'add', '-b', branch, path]);

    return { path, branch, agent };
  }

  async remove(agent: string, sessionId: string): Promise<void> {
    const path = join(this.worktreeDir, agent);
    const branch = makeBranchName(this.branchPrefix, agent, sessionId);

    await this.git.raw(['worktree', 'remove', path, '--force']);
    await this.git.raw(['branch', '-D', branch]).catch(() => {});
  }

  async list(): Promise<WorktreeInfo[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];

    const blocks = result.trim().split('\n\n');
    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));
      if (pathLine && branchLine) {
        const wtPath = pathLine.replace('worktree ', '');
        const fullBranch = branchLine.replace('branch refs/heads/', '');
        if (fullBranch.startsWith(this.branchPrefix)) {
          const agent = fullBranch.replace(this.branchPrefix, '').split('-')[0];
          worktrees.push({ path: wtPath, branch: fullBranch, agent });
        }
      }
    }

    return worktrees;
  }
}
```

- [ ] **Step 7: Run worktree tests**

```bash
npx vitest run tests/git/worktree-mgr.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 8: Write merge tests**

Create `tests/git/merge.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mergeAgentBranch } from '../../src/git/merge.js';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('merge', () => {
  const baseDir = join(tmpdir(), `triagent-merge-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(baseDir, { recursive: true });
    execSync('git init', { cwd: baseDir });
    execSync('git config user.email "test@test.com"', { cwd: baseDir });
    execSync('git config user.name "Test"', { cwd: baseDir });
    writeFileSync(join(baseDir, 'file.txt'), 'initial');
    execSync('git add . && git commit -m "initial"', { cwd: baseDir });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('should merge a clean branch', async () => {
    execSync('git checkout -b triagent/forge-s1', { cwd: baseDir });
    writeFileSync(join(baseDir, 'new-file.ts'), 'export const x = 1;');
    execSync('git add . && git commit -m "forge work"', { cwd: baseDir });
    execSync('git checkout main', { cwd: baseDir });

    const result = await mergeAgentBranch(baseDir, 'triagent/forge-s1');
    expect(result.success).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('should detect merge conflicts', async () => {
    writeFileSync(join(baseDir, 'file.txt'), 'main version');
    execSync('git add . && git commit -m "main change"', { cwd: baseDir });

    execSync('git checkout -b triagent/claude-s1 HEAD~1', { cwd: baseDir });
    writeFileSync(join(baseDir, 'file.txt'), 'claude version');
    execSync('git add . && git commit -m "claude change"', { cwd: baseDir });
    execSync('git checkout main', { cwd: baseDir });

    const result = await mergeAgentBranch(baseDir, 'triagent/claude-s1');
    expect(result.success).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 9: Implement merge.ts**

Create `src/git/merge.ts`:

```typescript
import simpleGit from 'simple-git';

interface MergeResult {
  success: boolean;
  conflicts: string[];
}

export async function mergeAgentBranch(repoDir: string, branch: string): Promise<MergeResult> {
  const git = simpleGit(repoDir);

  try {
    await git.merge([branch, '--no-ff']);
    return { success: true, conflicts: [] };
  } catch {
    const status = await git.status();
    const conflicts = status.conflicted;

    if (conflicts.length > 0) {
      await git.merge(['--abort']);
      return { success: false, conflicts };
    }

    throw new Error(`Merge of ${branch} failed for unknown reason`);
  }
}
```

- [ ] **Step 10: Run all git tests**

```bash
npx vitest run tests/git/
```

Expected: PASS (7 tests total)

- [ ] **Step 11: Commit**

```bash
git add src/git/ tests/git/
git commit -m "feat: add git module with worktree manager, branch naming, and merge"
```

---

## Task 6: Agent Drivers

**Files:**
- Create: `src/drivers/base-driver.ts`
- Create: `src/drivers/claude-driver.ts`
- Create: `src/drivers/forge-driver.ts`
- Create: `src/drivers/codex-driver.ts`
- Test: `tests/drivers/base-driver.test.ts`
- Fixture: `tests/fixtures/mock-agent.sh`
- Fixture: `tests/fixtures/mock-agent-fail.sh`

- [ ] **Step 1: Create mock agent scripts**

Create `tests/fixtures/mock-agent.sh`:

```bash
#!/bin/bash
echo "Starting task: $*"
sleep 0.1
echo "Working on implementation..."
sleep 0.1
echo "Task completed successfully."
exit 0
```

Create `tests/fixtures/mock-agent-fail.sh`:

```bash
#!/bin/bash
echo "Starting task: $*"
echo "Error: authentication required"
exit 1
```

```bash
chmod +x tests/fixtures/mock-agent.sh tests/fixtures/mock-agent-fail.sh
```

- [ ] **Step 2: Write driver tests**

Create `tests/drivers/base-driver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BaseDriver } from '../../src/drivers/base-driver.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('BaseDriver', () => {
  it('should spawn a mock agent and capture output', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'mock',
      command: join(FIXTURES, 'mock-agent.sh'),
      args: [],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
    });

    const exitCode = await driver.start('Implement feature X');
    expect(exitCode).toBe(0);

    const outputEvents = bus.getEventLog().filter((e) => e.event.type === 'agent:output');
    expect(outputEvents.length).toBeGreaterThan(0);
  });

  it('should detect non-zero exit as error', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'mock-fail',
      command: join(FIXTURES, 'mock-agent-fail.sh'),
      args: [],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
    });

    const exitCode = await driver.start('Implement feature X');
    expect(exitCode).not.toBe(0);

    const errorEvents = bus.getEventLog().filter((e) => e.event.type === 'agent:error');
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('should support kill lifecycle', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'mock',
      command: 'sleep',
      args: ['10'],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
    });

    const exitPromise = driver.start('');
    await new Promise((r) => setTimeout(r, 100));
    driver.kill();
    const exitCode = await exitPromise;
    expect(typeof exitCode).toBe('number');
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
npx vitest run tests/drivers/base-driver.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement base-driver.ts**

Create `src/drivers/base-driver.ts` — uses `node-pty` for PTY-based spawn (agents detect TTY). Falls back to `child_process.spawn` if node-pty unavailable (Risk #5).

```typescript
import type { TriAgentEventBus } from '../core/event-bus.js';

interface DriverOptions {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  bus: TriAgentEventBus;
  refreshMs: number;
  authErrorPatterns?: RegExp[];
}

export class BaseDriver {
  protected name: string;
  protected command: string;
  protected args: string[];
  protected cwd: string;
  protected bus: TriAgentEventBus;
  protected refreshMs: number;
  protected authErrorPatterns: RegExp[];
  protected ptyProcess: { pid: number; kill: (signal?: string) => void; onData: (cb: (data: string) => void) => void; onExit: (cb: (e: { exitCode: number }) => void) => void } | null = null;
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: DriverOptions) {
    this.name = options.name;
    this.command = options.command;
    this.args = options.args;
    this.cwd = options.cwd;
    this.bus = options.bus;
    this.refreshMs = options.refreshMs;
    this.authErrorPatterns = options.authErrorPatterns ?? [
      /authentication required/i,
      /session expired/i,
      /please log in/i,
      /unauthorized/i,
    ];
  }

  async start(taskDescription: string): Promise<number> {
    const fullArgs = [...this.args, taskDescription].filter(Boolean);

    try {
      // Primary: node-pty (agents detect TTY for proper interactive mode)
      const pty = await import('node-pty');
      return this.startWithPty(pty, fullArgs);
    } catch {
      // Fallback: child_process.spawn (Risk #5 mitigation)
      return this.startWithSpawn(fullArgs);
    }
  }

  private startWithPty(pty: typeof import('node-pty'), fullArgs: string[]): Promise<number> {
    return new Promise((resolve) => {
      // CRITICAL: argv array via node-pty, no shell string
      this.ptyProcess = pty.spawn(this.command, fullArgs, {
        name: 'xterm-256color',
        cwd: this.cwd,
        env: process.env as Record<string, string>,
      });

      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'working' });
      this.flushTimer = setInterval(() => this.flushBuffer(), this.refreshMs);

      this.ptyProcess.onData((data: string) => {
        const lines = data.split('\n').filter(Boolean);
        this.buffer.push(...lines);
        // Keep buffer capped at 500 lines (circular buffer)
        if (this.buffer.length > 500) this.buffer.splice(0, this.buffer.length - 500);
        this.checkAuthError(lines);
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        this.flushBuffer();
        if (this.flushTimer) clearInterval(this.flushTimer);

        if (exitCode !== 0) {
          this.bus.emit('agent:error', {
            type: 'agent:error', agent: this.name,
            error: `Process exited with code ${exitCode}`, isAuthError: false,
          });
        }

        this.bus.emit('agent:status', {
          type: 'agent:status', agent: this.name,
          status: exitCode === 0 ? 'done' : 'error',
        });

        resolve(exitCode);
      });
    });
  }

  private startWithSpawn(fullArgs: string[]): Promise<number> {
    const { spawn } = require('node:child_process');
    return new Promise((resolve) => {
      const proc = spawn(this.command, fullArgs, {
        cwd: this.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.ptyProcess = {
        pid: proc.pid!,
        kill: (sig?: string) => proc.kill(sig),
        onData: (cb: (data: string) => void) => {
          proc.stdout?.on('data', (d: Buffer) => cb(d.toString()));
          proc.stderr?.on('data', (d: Buffer) => cb(d.toString()));
        },
        onExit: (cb: (e: { exitCode: number }) => void) => {
          proc.on('close', (code: number | null) => cb({ exitCode: code ?? 1 }));
        },
      };

      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'working' });
      this.flushTimer = setInterval(() => this.flushBuffer(), this.refreshMs);

      this.ptyProcess.onData((data: string) => {
        const lines = data.split('\n').filter(Boolean);
        this.buffer.push(...lines);
        if (this.buffer.length > 500) this.buffer.splice(0, this.buffer.length - 500);
        this.checkAuthError(lines);
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        this.flushBuffer();
        if (this.flushTimer) clearInterval(this.flushTimer);
        if (exitCode !== 0) {
          this.bus.emit('agent:error', {
            type: 'agent:error', agent: this.name,
            error: `Process exited with code ${exitCode}`, isAuthError: false,
          });
        }
        this.bus.emit('agent:status', {
          type: 'agent:status', agent: this.name,
          status: exitCode === 0 ? 'done' : 'error',
        });
        resolve(exitCode);
      });
    });
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;
    const lines = this.buffer.splice(0);
    this.bus.emit('agent:output', { type: 'agent:output', agent: this.name, lines });
  }

  private checkAuthError(lines: string[]): void {
    for (const line of lines) {
      for (const pattern of this.authErrorPatterns) {
        if (pattern.test(line)) {
          this.bus.emit('agent:error', {
            type: 'agent:error', agent: this.name,
            error: `Auth error detected: ${line}`, isAuthError: true,
          });
          return;
        }
      }
    }
  }

  pause(): void {
    if (this.ptyProcess?.pid) {
      process.kill(this.ptyProcess.pid, 'SIGSTOP');
      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'paused' });
    }
  }

  resume(): void {
    if (this.ptyProcess?.pid) {
      process.kill(this.ptyProcess.pid, 'SIGCONT');
      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'working' });
    }
  }

  kill(): void {
    if (this.ptyProcess?.pid) {
      process.kill(this.ptyProcess.pid, 'SIGTERM');
    }
  }
}
```

- [ ] **Step 5: Run driver tests**

```bash
npx vitest run tests/drivers/base-driver.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Create concrete driver factories**

Create `src/drivers/claude-driver.ts`, `src/drivers/forge-driver.ts`, `src/drivers/codex-driver.ts` — thin factories:

```typescript
// src/drivers/claude-driver.ts
import { BaseDriver } from './base-driver.js';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { AgentConfig } from '../types.js';

export function createClaudeDriver(config: AgentConfig, cwd: string, bus: TriAgentEventBus, refreshMs: number) {
  return new BaseDriver({ name: 'claude', command: config.command, args: config.args, cwd, bus, refreshMs });
}
```

(Same pattern for forge and codex, changing `name` to `'forge'` and `'codex'`)

- [ ] **Step 7: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: Clean

- [ ] **Step 8: Commit**

```bash
git add src/drivers/ tests/drivers/ tests/fixtures/
git commit -m "feat: add agent drivers with process spawn, buffering, and lifecycle"
```

---

## Task 7: Planner

**Files:**
- Create: `src/core/planner.ts`
- Test: `tests/core/planner.test.ts`

- [ ] **Step 1: Write planner tests**

Create `tests/core/planner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { decompose } from '../../src/core/planner.js';

describe('Planner', () => {
  it('should decompose a full-stack task into subtasks', () => {
    const tasks = decompose('Implement user authentication with JWT');
    expect(tasks.length).toBeGreaterThan(1);
    const domains = tasks.map((t) => t.domain);
    expect(domains).toContain('backend');
  });

  it('should set dependencies for testing tasks', () => {
    const tasks = decompose('Add login page with form validation and tests');
    const testTask = tasks.find((t) => t.domain === 'testing');
    if (testTask) {
      expect(testTask.dependsOn.length).toBeGreaterThan(0);
    }
  });

  it('should tag frontend tasks correctly', () => {
    const tasks = decompose('Create a React dashboard with charts');
    const frontendTasks = tasks.filter((t) => t.domain === 'frontend');
    expect(frontendTasks.length).toBeGreaterThan(0);
  });

  it('should handle single-domain tasks', () => {
    const tasks = decompose('Fix the CSS styling on the navbar');
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].domain).toBe('frontend');
  });

  it('should assign unique IDs', () => {
    const tasks = decompose('Build API endpoints and frontend forms');
    const ids = tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/core/planner.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement planner.ts**

Create `src/core/planner.ts` — heuristic keyword-based decomposition. No LLM calls. See spec Section 2 (Planner).

The planner:
1. Splits task by conjunctions ("and", "with", "plus")
2. If single segment, checks for multiple domain keywords to auto-split
3. Classifies each segment by keyword match score
4. Adds implicit testing task if not present
5. Sets testing tasks to depend on all implementation tasks

```typescript
import type { SubTask } from '../types.js';

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: ['react', 'component', 'ui', 'css', 'html', 'page', 'form', 'dashboard', 'layout', 'style', 'design', 'navbar', 'sidebar', 'modal', 'button', 'frontend', 'next.js', 'tailwind', 'view'],
  backend: ['api', 'endpoint', 'route', 'middleware', 'database', 'db', 'schema', 'model', 'migration', 'server', 'auth', 'jwt', 'token', 'session', 'controller', 'service', 'backend', 'fastapi', 'express', 'rest', 'graphql'],
  testing: ['test', 'spec', 'e2e', 'unit test', 'integration test', 'coverage', 'mock', 'fixture', 'vitest', 'jest', 'pytest', 'testing'],
  'ci-cd': ['ci', 'cd', 'pipeline', 'github actions', 'deploy', 'docker', 'dockerfile', 'workflow', 'ci/cd', 'ci-cd'],
  docs: ['readme', 'documentation', 'docs', 'jsdoc', 'changelog', 'guide'],
  config: ['config', 'configuration', 'env', 'environment', 'setup', 'install', 'scaffold'],
};

function classifyDomain(text: string): string {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    scores[domain] = keywords.filter((k) => lower.includes(k)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'backend';
}

function splitIntoSegments(task: string): string[] {
  const connectors = /\b(and then|and|with|plus|also|then)\b/gi;
  const segments = task.split(connectors).filter((s) => !connectors.test(s) && s.trim());

  if (segments.length <= 1) {
    const domains = new Set<string>();
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some((k) => task.toLowerCase().includes(k))) {
        domains.add(domain);
      }
    }
    if (domains.size > 1) {
      return [...domains].map((d) => `${d}: ${task}`);
    }
  }

  return segments.length > 0 ? segments.map((s) => s.trim()) : [task];
}

let counter = 0;

export function decompose(task: string): SubTask[] {
  counter = 0;
  const segments = splitIntoSegments(task);
  const subtasks: SubTask[] = segments.map((seg) => ({
    id: `task-${++counter}`,
    description: seg.trim(),
    domain: classifyDomain(seg),
    dependsOn: [],
    status: 'pending',
  }));

  const hasTestTask = subtasks.some((t) => t.domain === 'testing');
  if (!hasTestTask && subtasks.length > 1) {
    const implIds = subtasks.map((t) => t.id);
    subtasks.push({
      id: `task-${++counter}`,
      description: `Write tests for: ${task}`,
      domain: 'testing',
      dependsOn: implIds,
      status: 'pending',
    });
  }

  for (const t of subtasks) {
    if (t.domain === 'testing' && t.dependsOn.length === 0) {
      t.dependsOn = subtasks.filter((s) => s.domain !== 'testing').map((s) => s.id);
    }
  }

  return subtasks;
}
```

- [ ] **Step 4: Run planner tests**

```bash
npx vitest run tests/core/planner.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/planner.ts tests/core/planner.test.ts
git commit -m "feat: add heuristic-based task planner with domain classification"
```

---

## Task 8: Scheduler

**Files:**
- Create: `src/core/scheduler.ts`
- Test: `tests/core/scheduler.test.ts`

- [ ] **Step 1: Write scheduler tests**

Create `tests/core/scheduler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Scheduler } from '../../src/core/scheduler.js';
import type { SubTask, TriAgentConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

describe('Scheduler', () => {
  const scheduler = new Scheduler(DEFAULT_CONFIG);

  it('should assign frontend tasks to claude', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Build login form', domain: 'frontend', dependsOn: [], status: 'pending' },
    ];
    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBe('claude');
  });

  it('should assign backend tasks to forge', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Create API endpoint', domain: 'backend', dependsOn: [], status: 'pending' },
    ];
    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBe('forge');
  });

  it('should assign testing tasks to codex', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Write unit tests', domain: 'testing', dependsOn: [], status: 'pending' },
    ];
    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBe('codex');
  });

  it('should use path-based routing when domains config exists', () => {
    const configWithDomains: TriAgentConfig = {
      ...DEFAULT_CONFIG,
      domains: { 'src/api/**': 'forge' },
    };
    const sched = new Scheduler(configWithDomains);
    const tasks: SubTask[] = [{
      id: 't1', description: 'Fix API bug', domain: 'frontend',
      targetPaths: ['src/api/auth.ts'], dependsOn: [], status: 'pending',
    }];
    const assigned = sched.assign(tasks);
    expect(assigned[0].assignedTo).toBe('forge');
  });

  it('should compute execution rounds from dependencies', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Backend', domain: 'backend', dependsOn: [], status: 'pending', assignedTo: 'forge' },
      { id: 't2', description: 'Frontend', domain: 'frontend', dependsOn: [], status: 'pending', assignedTo: 'claude' },
      { id: 't3', description: 'Tests', domain: 'testing', dependsOn: ['t1', 't2'], status: 'pending', assignedTo: 'codex' },
    ];
    const rounds = scheduler.computeRounds(tasks);
    expect(rounds.length).toBe(2);
    expect(rounds[0].map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(rounds[1].map((t) => t.id)).toEqual(['t3']);
  });

  it('should throw on circular dependency', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'A', domain: 'backend', dependsOn: ['t2'], status: 'pending', assignedTo: 'forge' },
      { id: 't2', description: 'B', domain: 'frontend', dependsOn: ['t1'], status: 'pending', assignedTo: 'claude' },
    ];
    expect(() => scheduler.computeRounds(tasks)).toThrow(/Circular dependency/);
  });

  it('should fallback to first agent for unknown domain', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Something', domain: 'unknown', dependsOn: [], status: 'pending' },
    ];
    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/core/scheduler.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement scheduler.ts**

Create `src/core/scheduler.ts`:

```typescript
import { minimatch } from 'minimatch';
import type { SubTask, TriAgentConfig, AgentName } from '../types.js';

export class Scheduler {
  private config: TriAgentConfig;

  constructor(config: TriAgentConfig) {
    this.config = config;
  }

  assign(tasks: SubTask[]): SubTask[] {
    return tasks.map((task) => ({ ...task, assignedTo: this.routeTask(task) }));
  }

  private routeTask(task: SubTask): AgentName {
    // Priority 1: Path-based routing
    if (this.config.domains && task.targetPaths?.length) {
      for (const [glob, agent] of Object.entries(this.config.domains)) {
        for (const p of task.targetPaths) {
          if (minimatch(p, glob)) return agent;
        }
      }
    }

    // Priority 2: Strength-based routing
    for (const [agentName, agentConfig] of Object.entries(this.config.agents)) {
      if (agentConfig.strengths.includes(task.domain)) return agentName;
    }

    // Priority 3: Fallback
    return Object.keys(this.config.agents)[0];
  }

  computeRounds(tasks: SubTask[]): SubTask[][] {
    const rounds: SubTask[][] = [];
    const completed = new Set<string>();
    let remaining = [...tasks];

    while (remaining.length > 0) {
      const ready = remaining.filter((t) => t.dependsOn.every((d) => completed.has(d)));
      if (ready.length === 0) {
        const cycleIds = remaining.map((t) => t.id).join(', ');
        throw new Error(`Circular dependency detected among tasks: ${cycleIds}`);
      }
      rounds.push(ready);
      for (const t of ready) completed.add(t.id);
      remaining = remaining.filter((t) => !completed.has(t.id));
    }

    return rounds;
  }
}
```

- [ ] **Step 4: Run scheduler tests**

```bash
npx vitest run tests/core/scheduler.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/scheduler.ts tests/core/scheduler.test.ts
git commit -m "feat: add scheduler with routing precedence and dependency rounds"
```

---

## Task 9: Session Orchestrator (moved before TUI so TUI can integrate-test against real events)

**Files:**
- Create: `src/tui/app.tsx`
- Create: `src/tui/agent-panel.tsx`
- Create: `src/tui/task-panel.tsx`
- Create: `src/tui/status-bar.tsx`
- Create: `src/tui/approval.tsx`
- Test: `tests/tui/app.test.tsx`

- [ ] **Step 1: Write TUI render test**

Create `tests/tui/app.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/tui/app.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';

describe('TUI App', () => {
  it('should render agent names', () => {
    const bus = new TriAgentEventBus();
    const { lastFrame } = render(
      <App bus={bus} agents={['claude', 'forge', 'codex']} tasks={[]} phase="init" />
    );
    expect(lastFrame()).toContain('CLAUDE');
    expect(lastFrame()).toContain('FORGE');
    expect(lastFrame()).toContain('CODEX');
  });

  it('should show current phase', () => {
    const bus = new TriAgentEventBus();
    const { lastFrame } = render(
      <App bus={bus} agents={['claude']} tasks={[]} phase="execute" />
    );
    expect(lastFrame()).toContain('EXECUTE');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/tui/app.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement TUI components**

Create all 5 TUI files. Each is a focused React component using Ink:

**`src/tui/agent-panel.tsx`** — Shows agent name, status badge, last N output lines, current task
**`src/tui/task-panel.tsx`** — Lists subtasks with status icons and agent assignments
**`src/tui/status-bar.tsx`** — Phase name, active agent count, elapsed time, hotkey hints
**`src/tui/approval.tsx`** — Full-screen overlay for plan approval (Y/N/E prompts)
**`src/tui/app.tsx`** — Root layout: horizontal Box of agent panels, task panel below, status bar at bottom. Subscribes to EventBus for real-time updates.

(Full code for each component is in the spec's architecture description. Implement per the layout described in spec Section 2, TUI Dashboard.)

- [ ] **Step 4: Run TUI tests**

```bash
npx vitest run tests/tui/
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/ tests/tui/
git commit -m "feat: add TUI dashboard with agent panels, task view, and status bar"
```

---

## Task 10: TUI Dashboard (now after Session so events are available for integration testing)

**Files:**
- Create: `src/core/session.ts`
- Test: `tests/core/session.test.ts`

- [ ] **Step 1: Write session tests**

Create `tests/core/session.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/core/session.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

describe('Session', () => {
  it('should start in init phase', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: DEFAULT_CONFIG, bus, repoDir: '/tmp/test', task: 'Build login' });
    expect(session.getPhase()).toBe('init');
  });

  it('should produce assigned subtasks after plan()', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: DEFAULT_CONFIG, bus, repoDir: '/tmp/test', task: 'Build frontend and backend API' });
    const plan = session.plan();
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((t) => t.assignedTo)).toBe(true);
  });

  it('should emit session:phase events', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: DEFAULT_CONFIG, bus, repoDir: '/tmp/test', task: 'Build something' });
    session.plan();
    const phases = bus.getEventLog().filter((e) => e.event.type === 'session:phase');
    expect(phases.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/core/session.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement session.ts**

Create `src/core/session.ts` — orchestrates the 5-phase lifecycle:

1. `plan()` — calls Planner.decompose + Scheduler.assign, emits events
2. `setup()` — creates worktrees via WorktreeManager
3. `execute()` — dispatches tasks in rounds, spawns BaseDrivers
4. `merge()` — merges agent branches sequentially, reports conflicts

(Full implementation as described in spec Section 3. Uses BaseDriver with argv-based spawn, never shell strings.)

- [ ] **Step 4: Run session tests**

```bash
npx vitest run tests/core/session.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/session.ts tests/core/session.test.ts
git commit -m "feat: add session orchestrator with plan, setup, execute, and merge phases"
```

---

## Task 11: CLI Entry Point

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: Implement cli.ts**

Create `src/cli.ts` using Commander.js with 4 commands:

- `triagent start <task>` — full session (plan → approve → setup → execute → merge)
- `triagent status` — check agent PATH + auth (two-stage health check)
- `triagent init` — copy example config to project root
- `triagent logs [session-id]` — read and display event log from `log_dir`
- `triagent cleanup` — run `git worktree prune`

Key implementation notes:
- Uses `execFileSync` (not `exec`) for health checks to prevent shell injection
- Approval gate uses readline prompt for MVP (TUI gate in v2)
- Renders Ink TUI after approval

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: Clean

- [ ] **Step 3: Test CLI help output**

```bash
npx tsx src/cli.ts --help
```

Expected: Shows usage with all 5 commands (start, status, init, logs, cleanup).

- [ ] **Step 4: Test status command**

```bash
npx tsx src/cli.ts status
```

Expected: Shows agent availability for claude, forge, codex.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add CLI entry point with start, status, init, and cleanup commands"
```

---

## Task 12: Integration Test with Mock Agents

**Files:**
- Create: `tests/integration/session.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/session.test.ts` — creates a temp git repo, uses mock agent shell scripts instead of real agents, runs `session.plan()` and `session.setup()`, verifies events were emitted and worktrees were created.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Session } from '../../src/core/session.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import type { TriAgentConfig } from '../../src/types.js';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('Integration: Full Session', () => {
  const baseDir = join(tmpdir(), `triagent-integration-${Date.now()}`);

  const mockConfig: TriAgentConfig = {
    agents: {
      agent1: { command: join(FIXTURES, 'mock-agent.sh'), args: [], strengths: ['frontend', 'design'], max_concurrent: 1, health_check: { command: 'true', args: [] } },
      agent2: { command: join(FIXTURES, 'mock-agent.sh'), args: [], strengths: ['backend', 'architecture'], max_concurrent: 1, health_check: { command: 'true', args: [] } },
    },
    git: { worktree_dir: '.triagent/worktrees', branch_prefix: 'triagent/', auto_merge: true, merge_strategy: 'sequential' },
    session: { require_approval: false, log_dir: '.triagent/logs', max_retries: 0, tui_refresh_ms: 50 },
  };

  beforeEach(() => {
    mkdirSync(baseDir, { recursive: true });
    execSync('git init', { cwd: baseDir });
    execSync('git config user.email "test@test.com"', { cwd: baseDir });
    execSync('git config user.name "Test"', { cwd: baseDir });
    writeFileSync(join(baseDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "initial"', { cwd: baseDir });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('should plan and assign tasks to mock agents', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: mockConfig, bus, repoDir: baseDir, task: 'Build React form with backend API' });
    const plan = session.plan();
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((t) => t.assignedTo === 'agent1')).toBe(true);
  });

  it('should create worktrees for assigned agents', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: mockConfig, bus, repoDir: baseDir, task: 'Build frontend and backend' });
    session.plan();
    await session.setup();
    const wtEvents = bus.getEventLog().filter((e) => e.event.type === 'git:worktree:created');
    expect(wtEvents.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npx vitest run tests/integration/
```

Expected: PASS (2 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test: add integration tests with mock agents"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (approx 30+ tests).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Clean, no errors.

- [ ] **Step 3: Test CLI end-to-end**

```bash
npx tsx src/cli.ts --help
npx tsx src/cli.ts status
```

Expected: Help shows all commands, status shows agent availability.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification - all tests pass, TypeScript clean"
```
