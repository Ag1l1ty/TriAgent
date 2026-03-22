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
    // Must clean up worktrees before deleting repo
    try {
      execSync('git worktree prune', { cwd: baseDir });
    } catch {}
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
