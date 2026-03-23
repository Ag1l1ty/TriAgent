import { describe, it, expect } from 'vitest';
import { BaseDriver } from '../../src/drivers/base-driver.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('BaseDriver', () => {
  it('should spawn a mock agent and capture output', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'mock',
      command: join(FIXTURES, 'mock-agent.sh'),
      args: [],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
    });

    const exitCode = await driver.start('Implement feature X');
    expect(exitCode).toBe(0);

    const outputEvents = bus.getEventLog().filter((e) => e.event.type === 'agent:output');
    expect(outputEvents.length).toBeGreaterThan(0);
  });

  it('should detect non-zero exit as error', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'mock-fail',
      command: join(FIXTURES, 'mock-agent-fail.sh'),
      args: [],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
    });

    const exitCode = await driver.start('Implement feature X');
    expect(exitCode).not.toBe(0);

    const errorEvents = bus.getEventLog().filter((e) => e.event.type === 'agent:error');
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('should support kill lifecycle', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'mock',
      command: 'sleep',
      args: ['10'],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
    });

    const exitPromise = driver.start('');
    await new Promise((r) => setTimeout(r, 100));
    driver.kill();
    const exitCode = await exitPromise;
    expect(typeof exitCode).toBe('number');
  });

  it('should fail when a task exceeds timeout', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const driver = new BaseDriver({
      name: 'slow-mock',
      command: join(FIXTURES, 'mock-agent-slow.sh'),
      args: [],
      cwd: '/tmp',
      bus,
      refreshMs: 50,
      timeoutMs: 50,
    });

    const exitCode = await driver.start('Very slow task');
    expect(exitCode).toBe(124);
    expect(bus.getEventLog().some((entry) => entry.event.type === 'agent:error')).toBe(true);
  });
});
