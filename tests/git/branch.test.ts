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
