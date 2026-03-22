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
