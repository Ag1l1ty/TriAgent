import { describe, it, expect } from 'vitest';
import { Session } from '../../src/core/session.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

describe('Session', () => {
  it('should start in init phase', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: DEFAULT_CONFIG, bus, repoDir: '/tmp/test', task: 'Build login' });
    expect(session.getPhase()).toBe('init');
    expect(session.getSessionId()).toBeTruthy();
  });

  it('should produce assigned subtasks after plan()', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: DEFAULT_CONFIG, bus, repoDir: '/tmp/test', task: 'Build frontend and backend API' });
    const plan = session.plan();
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((t) => t.assignedTo)).toBe(true);
  });

  it('should emit session:phase events', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config: DEFAULT_CONFIG, bus, repoDir: '/tmp/test', task: 'Build something' });
    session.plan();
    const phases = bus.getEventLog().filter((e) => e.event.type === 'session:phase');
    expect(phases.length).toBeGreaterThan(0);
  });
});
