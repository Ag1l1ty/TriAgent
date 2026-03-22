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
