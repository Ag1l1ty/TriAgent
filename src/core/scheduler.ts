import { minimatch } from 'minimatch';
import type { SubTask, TriAgentConfig, AgentName } from '../types.js';

export class Scheduler {
  private config: TriAgentConfig;

  constructor(config: TriAgentConfig) {
    this.config = config;
  }

  assign(tasks: SubTask[]): SubTask[] {
    return tasks.map((task) => ({ ...task, assignedTo: this.routeTask(task) }));
  }

  private routeTask(task: SubTask): AgentName {
    // Priority 1: Path-based routing
    if (this.config.domains && task.targetPaths?.length) {
      for (const [glob, agent] of Object.entries(this.config.domains)) {
        for (const p of task.targetPaths) {
          if (minimatch(p, glob)) return agent;
        }
      }
    }

    // Priority 2: Strength-based routing
    for (const [agentName, agentConfig] of Object.entries(this.config.agents)) {
      if (agentConfig.strengths.includes(task.domain)) return agentName;
    }

    // Priority 3: Fallback
    return Object.keys(this.config.agents)[0];
  }

  computeRounds(tasks: SubTask[]): SubTask[][] {
    const rounds: SubTask[][] = [];
    const completed = new Set<string>();
    let remaining = [...tasks];

    while (remaining.length > 0) {
      const ready = remaining.filter((t) => t.dependsOn.every((d) => completed.has(d)));
      if (ready.length === 0) {
        const cycleIds = remaining.map((t) => t.id).join(', ');
        throw new Error(`Circular dependency detected among tasks: ${cycleIds}`);
      }
      rounds.push(ready);
      for (const t of ready) completed.add(t.id);
      remaining = remaining.filter((t) => !completed.has(t.id));
    }

    return rounds;
  }
}
