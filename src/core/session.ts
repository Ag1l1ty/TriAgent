import type { SubTask, TriAgentConfig, SessionPhase } from '../types.js';
import type { TriAgentEventBus } from './event-bus.js';
import { decompose } from './planner.js';
import { Scheduler } from './scheduler.js';
import { WorktreeManager } from '../git/worktree-mgr.js';
import { mergeAgentBranch } from '../git/merge.js';
import { BaseDriver } from '../drivers/base-driver.js';
import { createClaudeDriver } from '../drivers/claude-driver.js';
import { createForgeDriver } from '../drivers/forge-driver.js';
import { createCodexDriver } from '../drivers/codex-driver.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { SessionPersistence } from '../persistence/session-persistence.js';

interface SessionOptions {
  config: TriAgentConfig;
  bus: TriAgentEventBus;
  repoDir: string;
  task: string;
}

interface WorktreeRuntimeInfo {
  path: string;
  branch: string;
  agent: string;
}

export class Session {
  private config: TriAgentConfig;
  private bus: TriAgentEventBus;
  private repoDir: string;
  private task: string;
  private phase: SessionPhase = 'init';
  private subtasks: SubTask[] = [];
  private scheduler: Scheduler;
  private sessionId: string;
  private worktreeManager: WorktreeManager | null = null;
  private worktreesByAgent = new Map<string, WorktreeRuntimeInfo>();
  private driversByTask = new Map<string, BaseDriver>();
  private persistence: SessionPersistence | null = null;

  constructor(options: SessionOptions) {
    this.config = options.config;
    this.bus = options.bus;
    this.repoDir = options.repoDir;
    this.task = options.task;
    this.scheduler = new Scheduler(this.config);
    this.sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (existsSync(this.repoDir)) {
      this.persistence = new SessionPersistence(this.repoDir, this.sessionId, this.config, this.bus);
    }
  }

  getPhase(): SessionPhase {
    return this.phase;
  }

  getSubtasks(): SubTask[] {
    return this.subtasks;
  }

  getSessionId(): string {
    return this.sessionId;
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

    void this.writeSnapshot();

    return this.subtasks;
  }

  async setup(): Promise<void> {
    this.setPhase('setup');

    if (this.subtasks.length === 0) {
      throw new Error('Cannot set up a session before planning tasks');
    }

    const activeAgents = [...new Set(this.subtasks
      .filter((t) => t.assignedTo)
      .map((t) => t.assignedTo!))];

    for (const agent of activeAgents) {
      if (this.worktreesByAgent.has(agent)) {
        continue;
      }

      const info = await this.getWorktreeManager().create(agent, this.sessionId);
      this.worktreesByAgent.set(agent, info);

      this.bus.emit('git:worktree:created', {
        type: 'git:worktree:created',
        agent,
        path: info.path,
        branch: info.branch,
      });
    }

    await this.writeSnapshot();
  }

  async execute(): Promise<void> {
    this.setPhase('execute');

    if (this.subtasks.length === 0) {
      throw new Error('Cannot execute a session before planning tasks');
    }

    if (this.worktreesByAgent.size === 0) {
      throw new Error('Cannot execute a session before setting up worktrees');
    }

    const rounds = this.scheduler.computeRounds(this.subtasks);
    let hadFailures = false;

    for (const round of rounds) {
      const runnableTasks: SubTask[] = [];

      for (const task of round) {
        const failedDependency = task.dependsOn
          .map((id) => this.subtasks.find((candidate) => candidate.id === id))
          .find((dependency) => dependency?.status === 'failed');

        if (failedDependency) {
          this.failTask(task, `Skipped because dependency ${failedDependency.id} failed`);
          hadFailures = true;
          continue;
        }

        runnableTasks.push(task);
      }

      const grouped = new Map<string, SubTask[]>();
      for (const task of runnableTasks) {
        const agent = task.assignedTo;
        if (!agent) {
          this.failTask(task, 'Task has no assigned agent');
          hadFailures = true;
          continue;
        }

        const agentTasks = grouped.get(agent) ?? [];
        agentTasks.push(task);
        grouped.set(agent, agentTasks);
      }

      const results = await Promise.all(
        [...grouped.entries()].map(([agent, tasks]) =>
          this.runTasksForAgent(agent, tasks))
      );

      if (results.some((result) => !result)) {
        hadFailures = true;
      }
    }

    if (hadFailures) {
      await this.writeSnapshot();
      await this.persistence?.flush();
      throw new Error(`Session ${this.sessionId} failed during execution`);
    }

    await this.writeSnapshot();
    await this.persistence?.flush();
  }

  async merge(): Promise<void> {
    this.setPhase('merge');

    if (!this.config.git.auto_merge || this.config.git.merge_strategy === 'manual') {
      await this.writeSnapshot();
      await this.persistence?.flush();
      this.setPhase('complete');
      return;
    }

    for (const [agent, info] of this.worktreesByAgent.entries()) {
      this.bus.emit('git:merge:start', { type: 'git:merge:start', agent });
      const result = await mergeAgentBranch(this.repoDir, info.branch);

      if (!result.success) {
        this.bus.emit('git:merge:conflict', {
          type: 'git:merge:conflict',
          agent,
          files: result.conflicts,
        });
        await this.writeSnapshot();
        await this.persistence?.flush();
        throw new Error(`Merge conflict while integrating ${info.branch}`);
      }

      this.bus.emit('git:merge:success', { type: 'git:merge:success', agent });
      await this.getWorktreeManager().remove(agent, this.sessionId, { deleteBranch: true });
    }

    this.worktreesByAgent.clear();
    await this.writeSnapshot();
    await this.persistence?.flush();
    this.setPhase('complete');
    await this.writeSnapshot();
    await this.persistence?.flush();
  }

  private async runTasksForAgent(agent: string, tasks: SubTask[]): Promise<boolean> {
    const agentConfig = this.config.agents[agent];
    const maxConcurrent = Math.max(1, agentConfig?.max_concurrent ?? 1);
    let nextIndex = 0;
    let failed = false;

    const worker = async () => {
      while (nextIndex < tasks.length) {
        const currentIndex = nextIndex++;
        const task = tasks[currentIndex];
        const ok = await this.runTask(task);
        if (!ok) {
          failed = true;
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker()));
    return !failed;
  }

  private async runTask(task: SubTask): Promise<boolean> {
    const agent = task.assignedTo;
    if (!agent) {
      this.failTask(task, 'Task has no assigned agent');
      return false;
    }

    const worktree = this.worktreesByAgent.get(agent);
    if (!worktree) {
      this.failTask(task, `No worktree available for agent ${agent}`);
      return false;
    }

    const agentConfig = this.config.agents[agent];
    if (!agentConfig) {
      this.failTask(task, `No configuration found for agent ${agent}`);
      return false;
    }

    task.status = 'running';
    this.bus.emit('task:started', { type: 'task:started', taskId: task.id, agent });

    const driver = this.createDriver(agent, worktree.path);
    this.driversByTask.set(task.id, driver);

    const attempts = Math.max(1, this.config.session.max_retries + 1);
    let lastError = `Process for task ${task.id} exited unsuccessfully`;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const exitCode = await driver.start(task.description);
      if (exitCode === 0) {
        task.status = 'done';
        this.bus.emit('task:completed', { type: 'task:completed', taskId: task.id, agent });
        return true;
      }

      lastError = `Process exited with code ${exitCode} on attempt ${attempt}/${attempts}`;
    }

    this.failTask(task, lastError);
    return false;
  }

  private createDriver(agent: string, cwd: string): BaseDriver {
    const agentConfig = this.config.agents[agent];
    const refreshMs = this.config.session.tui_refresh_ms;
    const timeoutMs = this.config.session.task_timeout_ms;

    switch (agent) {
      case 'claude':
        return createClaudeDriver(agentConfig, cwd, this.bus, refreshMs, timeoutMs);
      case 'forge':
        return createForgeDriver(agentConfig, cwd, this.bus, refreshMs, timeoutMs);
      case 'codex':
        return createCodexDriver(agentConfig, cwd, this.bus, refreshMs, timeoutMs);
      default:
        return new BaseDriver({
          name: agent,
          command: agentConfig.command,
          args: agentConfig.args,
          cwd,
          bus: this.bus,
          refreshMs,
          timeoutMs,
        });
    }
  }

  private getWorktreeManager(): WorktreeManager {
    if (!this.worktreeManager) {
      this.worktreeManager = new WorktreeManager({
        repoDir: this.repoDir,
        worktreeDir: join(this.repoDir, this.config.git.worktree_dir),
        branchPrefix: this.config.git.branch_prefix,
      });
    }

    return this.worktreeManager;
  }

  private failTask(task: SubTask, error: string): void {
    task.status = 'failed';
    this.bus.emit('task:failed', {
      type: 'task:failed',
      taskId: task.id,
      agent: task.assignedTo ?? 'unassigned',
      error,
    });
    void this.writeSnapshot();
  }

  private setPhase(phase: SessionPhase): void {
    this.phase = phase;
    this.bus.emit('session:phase', { type: 'session:phase', phase });
    void this.writeSnapshot();
  }

  private async writeSnapshot(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    await this.persistence.writeSnapshot({
      sessionId: this.sessionId,
      phase: this.phase,
      task: this.task,
      subtasks: this.subtasks,
      updatedAt: new Date().toISOString(),
    });
  }
}
