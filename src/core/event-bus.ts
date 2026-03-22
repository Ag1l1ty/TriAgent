import { EventEmitter } from 'eventemitter3';
import type { TriAgentEvent } from '../types.js';

interface EventLogEntry {
  timestamp: number;
  event: TriAgentEvent;
}

interface EventBusOptions {
  logging?: boolean;
}

export class TriAgentEventBus {
  private emitter = new EventEmitter();
  private log: EventLogEntry[] = [];
  private logging: boolean;

  constructor(options: EventBusOptions = {}) {
    this.logging = options.logging ?? false;
  }

  on<T extends TriAgentEvent['type']>(
    eventType: T,
    handler: (event: Extract<TriAgentEvent, { type: T }>) => void
  ): void {
    this.emitter.on(eventType, handler);
  }

  off<T extends TriAgentEvent['type']>(
    eventType: T,
    handler: (event: Extract<TriAgentEvent, { type: T }>) => void
  ): void {
    this.emitter.off(eventType, handler);
  }

  emit<T extends TriAgentEvent['type']>(
    eventType: T,
    event: Extract<TriAgentEvent, { type: T }>
  ): void {
    if (this.logging) {
      this.log.push({ timestamp: Date.now(), event });
    }
    this.emitter.emit(eventType, event);
  }

  getEventLog(): ReadonlyArray<EventLogEntry> {
    return this.log;
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
