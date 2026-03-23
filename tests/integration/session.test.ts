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
    // Clean up worktrees first to avoid git errors
    try { execSync('git worktree prune', { cwd: baseDir, stdio: 'pipe' }); } catch {}
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
