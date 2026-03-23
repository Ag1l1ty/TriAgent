import { BaseDriver } from './base-driver.js';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { AgentConfig } from '../types.js';

export function createCodexDriver(config: AgentConfig, cwd: string, bus: TriAgentEventBus, refreshMs: number) {
  return new BaseDriver({ name: 'codex', command: config.command, args: config.args, cwd, bus, refreshMs });
}
