import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TriAgentConfig } from '../../src/types.js';
import { collectDoctorReport } from '../../src/support/doctor.js';

describe('doctor', () => {
  const baseDir = join(tmpdir(), `triagent-doctor-${Date.now()}`);

  const config: TriAgentConfig = {
    agents: {
      healthy: {
        command: 'true',
        args: [],
        strengths: ['backend'],
        max_concurrent: 1,
        health_check: { command: 'true', args: [] },
        auth_check: { command: 'true', args: [] },
      },
      missing: {
        command: 'definitely-not-installed-command',
        args: [],
        strengths: ['frontend'],
        max_concurrent: 1,
        health_check: { command: 'definitely-not-installed-command', args: [] },
      },
    },
    git: {
      worktree_dir: '.triagent/worktrees',
      branch_prefix: 'triagent/',
      auto_merge: true,
      merge_strategy: 'sequential',
    },
    session: {
      require_approval: false,
      log_dir: '.triagent/logs',
      state_dir: '.triagent/sessions',
      max_retries: 0,
      task_timeout_ms: 1000,
      tui_refresh_ms: 50,
    },
  };

  beforeEach(() => {
    mkdirSync(baseDir, { recursive: true });
    execSync('git init', { cwd: baseDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: baseDir });
    execSync('git config user.name "Test"', { cwd: baseDir });
    writeFileSync(join(baseDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "initial"', { cwd: baseDir, stdio: 'pipe' });
    writeFileSync(join(baseDir, 'triagent.config.yaml'), 'agents: {}');
    mkdirSync(join(baseDir, '.triagent', 'logs'), { recursive: true });
    mkdirSync(join(baseDir, '.triagent', 'sessions'), { recursive: true });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('should collect repository and agent diagnostics', async () => {
    const report = await collectDoctorReport(baseDir, config);

    expect(report.isGitRepo).toBe(true);
    expect(report.configPresent).toBe(true);
    expect(report.logDirPresent).toBe(true);
    expect(report.stateDirPresent).toBe(true);
    expect(report.agents.find((agent) => agent.name === 'healthy')?.pathOk).toBe(true);
    expect(report.agents.find((agent) => agent.name === 'missing')?.pathOk).toBe(false);
  });
});
