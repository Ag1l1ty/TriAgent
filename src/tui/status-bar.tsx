import React from 'react';
import { Box, Text } from 'ink';
import type { SessionPhase } from '../types.js';

interface StatusBarProps {
  phase: SessionPhase;
  agentCount: number;
}

export function StatusBar({ phase, agentCount }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text bold color="blue">Phase: {phase.toUpperCase()}</Text>
      <Text>Agents: {agentCount}</Text>
      <Text dimColor>Tab:focus  Ctrl+P:pause  Ctrl+K:kill  Ctrl+C:quit</Text>
    </Box>
  );
}
