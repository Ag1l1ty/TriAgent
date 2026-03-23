import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { SubTask } from '../types.js';

interface ApprovalProps {
  tasks: SubTask[];
  onApprove: () => void;
  onReject: () => void;
}

export function Approval({ tasks, onApprove, onReject }: ApprovalProps) {
  useInput((input) => {
    const lower = input.toLowerCase();
    if (lower === 'y') {
      onApprove();
    } else if (lower === 'n') {
      onReject();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" paddingX={2} paddingY={1}>
      <Text bold color="yellow">PLAN APPROVAL</Text>
      <Box flexDirection="column" marginTop={1}>
        {tasks.map((task) => (
          <Text key={task.id}>
            {task.assignedTo ? `[${task.assignedTo}]` : '[?]'} {task.description}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Y to approve or N to reject</Text>
      </Box>
    </Box>
  );
}
