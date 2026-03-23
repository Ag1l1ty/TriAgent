import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Session } from '../../src/core/session.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import type { TriAgentConfig } from '../../src/types.js';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('Integration: Full Session', () => {
  const baseDir = join(tmpdir(), `triagent-integration-${Date.now()}`);

  const runtimeConfig: TriAgentConfig = {
    agents: {
      agent1: { command: join(FIXTURES, 'mock-agent-commit.sh'), args: [], strengths: ['frontend', 'design', 'testing'], max_concurrent: 1, health_check: { command: 'true', args: [] } },
      agent2: { command: join(FIXTURES, 'mock-agent-commit.sh'), args: [], strengths: ['backend', 'architecture'], max_concurrent: 1, health_check: { command: 'true', args: [] } },
    },
    git: { worktree_dir: '.triagent/worktrees', branch_prefix: 'triagent/', auto_merge: true, merge_strategy: 'sequential' },
    session: { require_approval: false, log_dir: '.triagent/logs', state_dir: '.triagent/sessions', max_retries: 0, task_timeout_ms: 300000, tui_refresh_ms: 50 },
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
    // Clean up worktrees first to avoid git errors
    try { execSync('git worktree prune', { cwd: baseDir, stdio: 'pipe' }); } catch {}
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('should plan and assign tasks to mock agents', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: runtimeConfig, bus, repoDir: baseDir, task: 'Build React form with backend API' });
    const plan = session.plan();
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((t) => t.assignedTo === 'agent1')).toBe(true);
  });

  it('should create worktrees for assigned agents', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: runtimeConfig, bus, repoDir: baseDir, task: 'Build frontend and backend' });
    session.plan();
    await session.setup();
    const wtEvents = bus.getEventLog().filter((e) => e.event.type === 'git:worktree:created');
    expect(wtEvents.length).toBeGreaterThan(0);
  });

  it('should execute subtasks and mark them as done', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: runtimeConfig, bus, repoDir: baseDir, task: 'Build frontend and backend and tests' });

    session.plan();
    await session.setup();
    await session.execute();

    expect(session.getSubtasks().every((task) => task.status === 'done')).toBe(true);
    expect(bus.getEventLog().some((entry) => entry.event.type === 'task:started')).toBe(true);
    expect(bus.getEventLog().some((entry) => entry.event.type === 'task:completed')).toBe(true);
  });

  it('should merge agent branches back into the repository', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: runtimeConfig, bus, repoDir: baseDir, task: 'Build frontend and backend and tests' });

    session.plan();
    await session.setup();
    await session.execute();
    await session.merge();

    const files = readdirSync(baseDir);
    expect(files).toContain('build-frontend-output.txt');
    expect(files).toContain('backend-output.txt');
    expect(session.getPhase()).toBe('complete');
    expect(existsSync(join(baseDir, '.triagent', 'logs', `${session.getSessionId()}.jsonl`))).toBe(true);
    expect(existsSync(join(baseDir, '.triagent', 'sessions', `${session.getSessionId()}.json`))).toBe(true);
  });

  it('should fail execution when an agent exits non-zero', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const failingConfig: TriAgentConfig = {
      ...runtimeConfig,
      agents: {
        ...runtimeConfig.agents,
        agent2: {
          ...runtimeConfig.agents.agent2,
          command: join(FIXTURES, 'mock-agent-fail.sh'),
        },
      },
    };
    const session = new Session({ config: failingConfig, bus, repoDir: baseDir, task: 'Build frontend and backend' });

    session.plan();
    await session.setup();

    await expect(session.execute()).rejects.toThrow(/failed during execution/);
    expect(session.getSubtasks().some((task) => task.status === 'failed')).toBe(true);
    expect(bus.getEventLog().some((entry) => entry.event.type === 'task:failed')).toBe(true);
  });

  it('should emit merge conflicts and preserve session state for manual resolution', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const conflictConfig: TriAgentConfig = {
      agents: {
        agent1: {
          command: join(FIXTURES, 'mock-agent-conflict.sh'),
          args: ['alpha'],
          strengths: ['frontend', 'testing'],
          max_concurrent: 1,
          health_check: { command: 'true', args: [] },
        },
        agent2: {
          command: join(FIXTURES, 'mock-agent-conflict.sh'),
          args: ['beta'],
          strengths: ['backend'],
          max_concurrent: 1,
          health_check: { command: 'true', args: [] },
        },
      },
      git: { worktree_dir: '.triagent/worktrees', branch_prefix: 'triagent/', auto_merge: true, merge_strategy: 'sequential' },
      session: { require_approval: false, log_dir: '.triagent/logs', state_dir: '.triagent/sessions', max_retries: 0, task_timeout_ms: 300000, tui_refresh_ms: 50 },
    };
    const session = new Session({ config: conflictConfig, bus, repoDir: baseDir, task: 'Build frontend and backend and tests' });

    session.plan();
    await session.setup();
    await session.execute();

    await expect(session.merge()).rejects.toThrow(/Merge conflict/);
    expect(bus.getEventLog().some((entry) => entry.event.type === 'git:merge:conflict')).toBe(true);
    expect(existsSync(join(baseDir, '.triagent', 'worktrees', session.getSessionId()))).toBe(true);
  });
});
