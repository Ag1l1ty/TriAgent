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
        state_dir: '.triagent/sessions',
        max_retries: 2,
        task_timeout_ms: 300000,
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
        state_dir: '.triagent/sessions',
        max_retries: 2,
        task_timeout_ms: 300000,
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
        state_dir: '.triagent/sessions',
        max_retries: 2,
        task_timeout_ms: 300000,
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
        state_dir: '.triagent/sessions',
        max_retries: 2,
        task_timeout_ms: 300000,
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
