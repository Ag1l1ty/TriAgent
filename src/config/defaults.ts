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
    state_dir: '.triagent/sessions',
    max_retries: 2,
    task_timeout_ms: 300000,
    tui_refresh_ms: 100,
  },
};
