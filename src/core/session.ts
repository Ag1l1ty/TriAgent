import type { SubTask, TriAgentConfig, SessionPhase } from '../types.js';
import type { TriAgentEventBus } from './event-bus.js';
import { decompose } from './planner.js';
import { Scheduler } from './scheduler.js';

interface SessionOptions {
  config: TriAgentConfig;
  bus: TriAgentEventBus;
  repoDir: string;
  task: string;
}

export class Session {
  private config: TriAgentConfig;
  private bus: TriAgentEventBus;
  private repoDir: string;
  private task: string;
  private phase: SessionPhase = 'init';
  private subtasks: SubTask[] = [];
  private scheduler: Scheduler;

  constructor(options: SessionOptions) {
    this.config = options.config;
    this.bus = options.bus;
    this.repoDir = options.repoDir;
    this.task = options.task;
    this.scheduler = new Scheduler(this.config);
  }

  getPhase(): SessionPhase {
    return this.phase;
  }

  getSubtasks(): SubTask[] {
    return this.subtasks;
  }

  plan(): SubTask[] {
    this.setPhase('plan');

    // Decompose task into subtasks
    const rawTasks = decompose(this.task);

    // Emit task:created events
    for (const task of rawTasks) {
      this.bus.emit('task:created', { type: 'task:created', task });
    }

    // Assign agents to tasks
    this.subtasks = this.scheduler.assign(rawTasks);

    // Emit task:assigned events
    for (const task of this.subtasks) {
      if (task.assignedTo) {
        this.bus.emit('task:assigned', { type: 'task:assigned', task, agent: task.assignedTo });
      }
    }

    return this.subtasks;
  }

  async setup(): Promise<void> {
    this.setPhase('setup');
    // WorktreeManager.create() for each active agent — implemented in integration
  }

  async execute(): Promise<void> {
    this.setPhase('execute');
    // Dispatch rounds of tasks to drivers — implemented in integration
  }

  async merge(): Promise<void> {
    this.setPhase('merge');
    // Merge agent branches — implemented in integration
    this.setPhase('complete');
  }

  private setPhase(phase: SessionPhase): void {
    this.phase = phase;
    this.bus.emit('session:phase', { type: 'session:phase', phase });
  }
}
