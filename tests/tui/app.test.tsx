import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/tui/app.js';
import { TriAgentEventBus } from '../../src/core/event-bus.js';

describe('TUI App', () => {
  it('should render agent names', () => {
    const bus = new TriAgentEventBus();
    const { lastFrame } = render(
      <App bus={bus} agents={['claude', 'forge', 'codex']} tasks={[]} phase="init" />
    );
    expect(lastFrame()).toContain('CLAUDE');
    expect(lastFrame()).toContain('FORGE');
    expect(lastFrame()).toContain('CODEX');
  });

  it('should show current phase', () => {
    const bus = new TriAgentEventBus();
    const { lastFrame } = render(
      <App bus={bus} agents={['claude']} tasks={[]} phase="execute" />
    );
    expect(lastFrame()).toContain('EXECUTE');
  });
});
