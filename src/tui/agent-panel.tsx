import React from 'react';
import { Box, Text } from 'ink';

interface AgentPanelProps {
  name: string;
  status: string;
  lines: string[];
  maxLines?: number;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'gray',
  working: 'green',
  paused: 'yellow',
  error: 'red',
  done: 'cyan',
};

export function AgentPanel({ name, status, lines, maxLines = 10 }: AgentPanelProps) {
  const displayLines = lines.slice(-maxLines);
  const color = STATUS_COLORS[status] ?? 'white';

  return (
    <Box flexDirection="column" borderStyle="single" width="33%" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>{name.toUpperCase()}</Text>
        <Text color={color}>[{status.toUpperCase()}]</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {displayLines.map((line, i) => (
          <Text key={i} dimColor wrap="truncate">{line}</Text>
        ))}
        {displayLines.length === 0 && <Text dimColor>No output yet</Text>}
      </Box>
    </Box>
  );
}
