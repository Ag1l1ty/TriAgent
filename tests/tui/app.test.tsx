import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/tui/app.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';

describe('TUI App', () => {
  it('should render agent names from props', () => {
    const bus = new TriAgentEventBus({ logging: true });
    const { lastFrame } = render(
      <App bus={bus} agents={['claude', 'forge', 'codex']} />
    );

    expect(lastFrame()).toContain('CLAUDE');
    expect(lastFrame()).toContain('FORGE');
    expect(lastFrame()).toContain('CODEX');
  });

  it('should react to bus phase and task events', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const { lastFrame } = render(
      <App bus={bus} agents={['claude']} />
    );

    bus.emit('session:phase', { type: 'session:phase', phase: 'execute' });
    bus.emit('task:created', {
      type: 'task:created',
      task: {
        id: 't1',
        description: 'Build login form',
        domain: 'frontend',
        dependsOn: [],
        status: 'pending',
      },
    });
    bus.emit('task:assigned', {
      type: 'task:assigned',
      task: {
        id: 't1',
        description: 'Build login form',
        domain: 'frontend',
        dependsOn: [],
        status: 'pending',
      },
      agent: 'claude',
    });
    bus.emit('task:started', { type: 'task:started', taskId: 't1', agent: 'claude' });
    bus.emit('agent:output', { type: 'agent:output', agent: 'claude', lines: ['Working on login form'] });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(lastFrame()).toContain('EXECUTE');
    expect(lastFrame()).toContain('Build login form');
    expect(lastFrame()).toContain('Working on login form');
    expect(lastFrame()).toContain('[claude]');
  });

  it('should handle approval input through Ink', async () => {
    const bus = new TriAgentEventBus({ logging: true });
    const onApprove = vi.fn();
    const onReject = vi.fn();

    bus.emit('task:created', {
      type: 'task:created',
      task: {
        id: 't1',
        description: 'Review plan',
        domain: 'docs',
        dependsOn: [],
        status: 'pending',
      },
    });

    const { lastFrame, stdin } = render(
      <App
        bus={bus}
        agents={['claude']}
        requiresApproval
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(lastFrame()).toContain('PLAN APPROVAL');
    stdin.write('y');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).not.toHaveBeenCalled();
  });
});
