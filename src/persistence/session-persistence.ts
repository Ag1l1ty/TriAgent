import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { SessionPhase, SubTask, TriAgentConfig, TriAgentEvent } from '../types.js';

interface SessionSnapshot {
  sessionId: string;
  phase: SessionPhase;
  task: string;
  subtasks: SubTask[];
  updatedAt: string;
}

export class SessionPersistence {
  private logFile: string;
  private stateFile: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(repoDir: string, sessionId: string, config: TriAgentConfig, bus: TriAgentEventBus) {
    this.logFile = join(repoDir, config.session.log_dir, `${sessionId}.jsonl`);
    this.stateFile = join(repoDir, config.session.state_dir, `${sessionId}.json`);

    const eventTypes: TriAgentEvent['type'][] = [
      'task:created',
      'task:assigned',
      'task:started',
      'task:completed',
      'task:failed',
      'agent:output',
      'agent:status',
      'agent:error',
      'git:worktree:created',
      'git:merge:start',
      'git:merge:success',
      'git:merge:conflict',
      'session:phase',
    ];

    for (const eventType of eventTypes) {
      bus.on(eventType, (event) => {
        void this.appendEvent(event);
      });
    }
  }

  async writeSnapshot(snapshot: SessionSnapshot): Promise<void> {
    await this.enqueue(async () => {
      await mkdir(dirname(this.stateFile), { recursive: true });
      await writeFile(this.stateFile, JSON.stringify(snapshot, null, 2));
    });
  }

  async flush(): Promise<void> {
    await this.writeChain;
  }

  private async appendEvent(event: TriAgentEvent): Promise<void> {
    await this.enqueue(async () => {
      await mkdir(dirname(this.logFile), { recursive: true });
      await appendFile(this.logFile, `${JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
      })}\n`);
    });
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    this.writeChain = this.writeChain.then(operation);
    await this.writeChain;
  }
}
