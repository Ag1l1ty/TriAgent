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
    health_check:
      command: claude
      args: ["--version"]
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
