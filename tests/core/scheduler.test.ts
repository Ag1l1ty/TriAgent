import { describe, it, expect } from 'vitest';
import { Scheduler } from '../../src/core/scheduler.js';
import type { SubTask, TriAgentConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

describe('Scheduler', () => {
  const scheduler = new Scheduler(DEFAULT_CONFIG);

  it('should assign frontend tasks to claude', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Build login form', domain: 'frontend', dependsOn: [], status: 'pending', targetPaths: ['src/components/App.tsx'] },
    ];

    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBe('claude');
  });

  it('should assign backend tasks to forge', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Create API endpoint', domain: 'backend', dependsOn: [], status: 'pending', targetPaths: ['src/api/index.ts'] },
    ];

    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBe('forge');
  });

  it('should assign testing tasks to codex', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Write unit tests', domain: 'testing', dependsOn: [], status: 'pending', targetPaths: ['tests/app.test.ts'] },
    ];

    const assigned = scheduler.assign(tasks);
    expect(assigned[0].assignedTo).toBe('codex');
  });

  it('should use path-based routing when domains config exists', () => {
    const configWithDomains: TriAgentConfig = {
      ...DEFAULT_CONFIG,
      domains: { 'src/api/**': 'forge' },
    };
    const sched = new Scheduler(configWithDomains);
    const tasks: SubTask[] = [{
      id: 't1',
      description: 'Fix API bug',
      domain: 'frontend',
      targetPaths: ['src/api/auth.ts'],
      dependsOn: [],
      status: 'pending',
    }];

    const assigned = sched.assign(tasks);
    expect(assigned[0].assignedTo).toBe('forge');
  });

  it('should balance unknown-domain tasks based on load and capacity', () => {
    const config: TriAgentConfig = {
      ...DEFAULT_CONFIG,
      agents: {
        alpha: {
          command: 'alpha',
          args: ['-p'],
          strengths: ['unknown'],
          max_concurrent: 1,
          health_check: { command: 'alpha', args: ['--version'] },
        },
        beta: {
          command: 'beta',
          args: ['-p'],
          strengths: ['unknown'],
          max_concurrent: 3,
          health_check: { command: 'beta', args: ['--version'] },
        },
      },
    };
    const sched = new Scheduler(config);
    const tasks: SubTask[] = [
      { id: 't1', description: 'Something 1', domain: 'unknown', dependsOn: [], status: 'pending' },
      { id: 't2', description: 'Something 2', domain: 'unknown', dependsOn: [], status: 'pending' },
      { id: 't3', description: 'Something 3', domain: 'unknown', dependsOn: [], status: 'pending' },
    ];

    const assigned = sched.assign(tasks);
    expect(assigned.filter((task) => task.assignedTo === 'beta').length).toBeGreaterThan(1);
  });

  it('should compute execution rounds from dependencies', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Backend', domain: 'backend', dependsOn: [], status: 'pending', assignedTo: 'forge' },
      { id: 't2', description: 'Frontend', domain: 'frontend', dependsOn: [], status: 'pending', assignedTo: 'claude' },
      { id: 't3', description: 'Tests', domain: 'testing', dependsOn: ['t1', 't2'], status: 'pending', assignedTo: 'codex' },
    ];

    const rounds = scheduler.computeRounds(tasks);
    expect(rounds.length).toBe(2);
    expect(rounds[0].map((task) => task.id).sort()).toEqual(['t1', 't2']);
    expect(rounds[1].map((task) => task.id)).toEqual(['t3']);
  });

  it('should throw on circular dependency', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'A', domain: 'backend', dependsOn: ['t2'], status: 'pending', assignedTo: 'forge' },
      { id: 't2', description: 'B', domain: 'frontend', dependsOn: ['t1'], status: 'pending', assignedTo: 'claude' },
    ];

    expect(() => scheduler.computeRounds(tasks)).toThrow(/Circular dependency/);
  });
});
