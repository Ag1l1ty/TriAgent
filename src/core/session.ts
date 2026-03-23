import type { SubTask, TriAgentConfig, SessionPhase } from '../types.js';
import type { TriAgentEventBus } from './event-bus.js';
import { decompose } from './planner.js';
import { Scheduler } from './scheduler.js';
import { WorktreeManager } from '../git/worktree-mgr.js';
import { join } from 'node:path';

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

    const activeAgents = [...new Set(this.subtasks
      .filter((t) => t.assignedTo)
      .map((t) => t.assignedTo!))];

    const sessionId = Date.now().toString(36);
    const wm = new WorktreeManager({
      repoDir: this.repoDir,
      worktreeDir: join(this.repoDir, this.config.git.worktree_dir),
      branchPrefix: this.config.git.branch_prefix,
    });

    for (const agent of activeAgents) {
      const info = await wm.create(agent, sessionId);

      this.bus.emit('git:worktree:created', {
        type: 'git:worktree:created',
        agent,
        path: info.path,
        branch: info.branch,
      });
    }
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
