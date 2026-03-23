import React from 'react';
import { Box } from 'ink';
import { AgentPanel } from './agent-panel.js';
import { TaskPanel } from './task-panel.js';
import { StatusBar } from './status-bar.js';
import { Approval } from './approval.js';
import { useTriAgentState } from './state.js';
import type { TriAgentEventBus } from '../core/event-bus.js';

interface AppProps {
  bus: TriAgentEventBus;
  agents: string[];
  requiresApproval?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

export function App({ bus, agents, requiresApproval = false, onApprove, onReject }: AppProps) {
  const state = useTriAgentState(bus, agents);
  const [approvalPending, setApprovalPending] = React.useState(requiresApproval);

  React.useEffect(() => {
    setApprovalPending(requiresApproval);
  }, [requiresApproval]);

  return (
    <Box flexDirection="column">
      <Box>
        {agents.map((agent) => (
          <AgentPanel
            key={agent}
            name={agent}
            status={state.agents[agent]?.status ?? 'idle'}
            lines={state.agents[agent]?.lines ?? []}
          />
        ))}
      </Box>
      {approvalPending && onApprove && onReject && (
        <Approval
          tasks={state.tasks}
          onApprove={() => {
            setApprovalPending(false);
            onApprove();
          }}
          onReject={() => {
            setApprovalPending(false);
            onReject();
          }}
        />
      )}
      <TaskPanel tasks={state.tasks} />
      <StatusBar phase={state.phase} agentCount={agents.length} requiresApproval={approvalPending} />
    </Box>
  );
}
