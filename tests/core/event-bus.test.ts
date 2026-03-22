import { describe, it, expect, vi } from 'vitest';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import type { SubTask } from '../../src/types.js';

describe('TriAgentEventBus', () => {
  it('should emit and receive typed events', () => {
    const bus = new TriAgentEventBus();
    const handler = vi.fn();

    bus.on('task:created', handler);
    const task: SubTask = {
      id: 't1',
      description: 'Test task',
      domain: 'backend',
      dependsOn: [],
      status: 'pending',
    };
    bus.emit('task:created', { type: 'task:created', task });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: 'task:created', task });
  });

  it('should log events when logging is enabled', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const task: SubTask = {
      id: 't1',
      description: 'Test',
      domain: 'frontend',
      dependsOn: [],
      status: 'pending',
    };

    bus.emit('task:created', { type: 'task:created', task });
    bus.emit('session:phase', { type: 'session:phase', phase: 'init' });

    const log = bus.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].event.type).toBe('task:created');
    expect(log[1].event.type).toBe('session:phase');
  });

  it('should not log events when logging is disabled', () => {
    const bus = new TriAgentEventBus({ logging: false });
    bus.emit('session:phase', { type: 'session:phase', phase: 'init' });
    expect(bus.getEventLog()).toHaveLength(0);
  });

  it('should support removeAllListeners', () => {
    const bus = new TriAgentEventBus();
    const handler = vi.fn();
    bus.on('agent:status', handler);
    bus.removeAllListeners();
    bus.emit('agent:status', { type: 'agent:status', agent: 'claude', status: 'idle' });
    expect(handler).not.toHaveBeenCalled();
  });
});
