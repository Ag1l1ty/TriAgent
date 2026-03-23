import { BaseDriver } from './base-driver.js';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { AgentConfig } from '../types.js';

export function createForgeDriver(config: AgentConfig, cwd: string, bus: TriAgentEventBus, refreshMs: number) {
  return new BaseDriver({ name: 'forge', command: config.command, args: config.args, cwd, bus, refreshMs });
}
