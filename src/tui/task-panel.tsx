import React from 'react';
import { Box, Text } from 'ink';
import type { SubTask } from '../types.js';

interface TaskPanelProps {
  tasks: SubTask[];
}

const STATUS_ICONS: Record<string, string> = {
  pending: '○',
  running: '●',
  done: '✓',
  failed: '✗',
};

export function TaskPanel({ tasks }: TaskPanelProps) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>TASKS</Text>
      {tasks.length === 0 && <Text dimColor>No tasks</Text>}
      {tasks.map((task) => (
        <Box key={task.id} gap={1}>
          <Text>{STATUS_ICONS[task.status] ?? '?'}</Text>
          <Text>{task.description}</Text>
          {task.assignedTo && <Text dimColor>[{task.assignedTo}]</Text>}
        </Box>
      ))}
    </Box>
  );
}
