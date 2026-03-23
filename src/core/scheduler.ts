import { minimatch } from 'minimatch';
import type { SubTask, TriAgentConfig, AgentName } from '../types.js';

interface CandidateScore {
  agent: AgentName;
  score: number;
  load: number;
}

export class Scheduler {
  private config: TriAgentConfig;

  constructor(config: TriAgentConfig) {
    this.config = config;
  }

  assign(tasks: SubTask[]): SubTask[] {
    const assignedCounts = new Map<AgentName, number>();

    return tasks.map((task) => {
      const assignedTo = this.routeTask(task, assignedCounts);
      assignedCounts.set(assignedTo, (assignedCounts.get(assignedTo) ?? 0) + 1);
      return { ...task, assignedTo };
    });
  }

  private routeTask(task: SubTask, assignedCounts: Map<AgentName, number>): AgentName {
    const candidates = Object.entries(this.config.agents).map(([agentName, agentConfig]) => {
      const currentLoad = assignedCounts.get(agentName) ?? 0;
      const maxConcurrent = Math.max(1, agentConfig.max_concurrent);
      const loadRatio = currentLoad / maxConcurrent;
      let score = 0;

      if (this.config.domains && task.targetPaths?.length) {
        const matchedPaths = Object.entries(this.config.domains).some(([glob, configuredAgent]) =>
          configuredAgent === agentName &&
          task.targetPaths!.some((path) => minimatch(path, glob))
        );

        if (matchedPaths) {
          score += 100;
        }
      }

      if (agentConfig.strengths.includes(task.domain)) {
        score += 50;
      }

      if (task.targetPaths?.some((path) => path.includes('tests')) && agentConfig.strengths.includes('testing')) {
        score += 15;
      }

      if (task.targetPaths?.some((path) => path.includes('docs') || path.includes('README')) && agentConfig.strengths.includes('docs')) {
        score += 15;
      }

      if (task.targetPaths?.some((path) => path.includes('.github') || path.includes('Dockerfile')) && agentConfig.strengths.includes('ci-cd')) {
        score += 15;
      }

      score -= loadRatio * 10;

      return {
        agent: agentName,
        score,
        load: currentLoad,
      } satisfies CandidateScore;
    });

    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.load !== b.load) {
        return a.load - b.load;
      }

      return a.agent.localeCompare(b.agent);
    });

    return candidates[0]?.agent ?? Object.keys(this.config.agents)[0];
  }

  computeRounds(tasks: SubTask[]): SubTask[][] {
    const rounds: SubTask[][] = [];
    const completed = new Set<string>();
    let remaining = [...tasks];

    while (remaining.length > 0) {
      const ready = remaining
        .filter((task) => task.dependsOn.every((dependency) => completed.has(dependency)))
        .sort((a, b) => {
          if (a.dependsOn.length !== b.dependsOn.length) {
            return a.dependsOn.length - b.dependsOn.length;
          }

          if ((a.assignedTo ?? '') !== (b.assignedTo ?? '')) {
            return (a.assignedTo ?? '').localeCompare(b.assignedTo ?? '');
          }

          return a.id.localeCompare(b.id);
        });

      if (ready.length === 0) {
        const cycleIds = remaining.map((task) => task.id).join(', ');
        throw new Error(`Circular dependency detected among tasks: ${cycleIds}`);
      }

      rounds.push(ready);
      for (const task of ready) completed.add(task.id);
      remaining = remaining.filter((task) => !completed.has(task.id));
    }

    return rounds;
  }
}
