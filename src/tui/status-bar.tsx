import React from 'react';
import { Box, Text } from 'ink';
import type { SessionPhase } from '../types.js';

interface StatusBarProps {
  phase: SessionPhase;
  agentCount: number;
  requiresApproval?: boolean;
}

export function StatusBar({ phase, agentCount, requiresApproval = false }: StatusBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text bold color="blue">Phase: {phase.toUpperCase()}</Text>
      <Text>Agents: {agentCount}</Text>
      <Text dimColor>
        {requiresApproval ? 'Y:approve  N:reject' : 'Live session view  Ctrl+C:quit'}
      </Text>
    </Box>
  );
}
