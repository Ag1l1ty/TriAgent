import React from 'react';
import { Box } from 'ink';
import { AgentPanel } from './agent-panel.js';
import { TaskPanel } from './task-panel.js';
import { StatusBar } from './status-bar.js';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { SubTask, SessionPhase } from '../types.js';

interface AppProps {
  bus: TriAgentEventBus;
  agents: string[];
  tasks: SubTask[];
  phase: SessionPhase;
}

export function App({ agents, tasks, phase }: AppProps) {
  return (
    <Box flexDirection="column">
      <Box>
        {agents.map((agent) => (
          <AgentPanel key={agent} name={agent} status="idle" lines={[]} />
        ))}
      </Box>
      <TaskPanel tasks={tasks} />
      <StatusBar phase={phase} agentCount={agents.length} />
    </Box>
  );
}
