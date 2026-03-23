import { BaseDriver } from './base-driver.js';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { AgentConfig } from '../types.js';

export function createClaudeDriver(config: AgentConfig, cwd: string, bus: TriAgentEventBus, refreshMs: number, timeoutMs?: number) {
  return new BaseDriver({ name: 'claude', command: config.command, args: config.args, cwd, bus, refreshMs, timeoutMs });
}
