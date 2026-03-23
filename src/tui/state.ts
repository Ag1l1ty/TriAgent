import { useEffect, useState } from 'react';
import type { TriAgentEventBus } from '../core/event-bus.js';
import type { AgentStatus, SessionPhase, SubTask, TriAgentEvent } from '../types.js';

export interface AgentViewState {
  name: string;
  status: AgentStatus;
  lines: string[];
  lastError?: string;
}

export interface TuiState {
  phase: SessionPhase;
  tasks: SubTask[];
  agents: Record<string, AgentViewState>;
}

function createInitialAgents(agentNames: string[]): Record<string, AgentViewState> {
  return Object.fromEntries(agentNames.map((name) => [name, {
    name,
    status: 'idle' as AgentStatus,
    lines: [],
  }]));
}

function updateTask(tasks: SubTask[], taskId: string, updater: (task: SubTask) => SubTask): SubTask[] {
  return tasks.map((task) => (task.id === taskId ? updater(task) : task));
}

export function reduceTuiState(state: TuiState, event: TriAgentEvent): TuiState {
  switch (event.type) {
    case 'session:phase':
      return { ...state, phase: event.phase };

    case 'task:created':
      return { ...state, tasks: [...state.tasks, event.task] };

    case 'task:assigned':
      return {
        ...state,
        tasks: updateTask(state.tasks, event.task.id, (task) => ({ ...task, assignedTo: event.agent })),
      };

    case 'task:started':
      return {
        ...state,
        tasks: updateTask(state.tasks, event.taskId, (task) => ({ ...task, status: 'running' })),
      };

    case 'task:completed':
      return {
        ...state,
        tasks: updateTask(state.tasks, event.taskId, (task) => ({ ...task, status: 'done' })),
      };

    case 'task:failed':
      return {
        ...state,
        tasks: updateTask(state.tasks, event.taskId, (task) => ({ ...task, status: 'failed' })),
      };

    case 'agent:status':
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agent]: {
            name: event.agent,
            status: event.status,
            lines: state.agents[event.agent]?.lines ?? [],
            lastError: state.agents[event.agent]?.lastError,
          },
        },
      };

    case 'agent:output': {
      const existing = state.agents[event.agent] ?? { name: event.agent, status: 'idle' as AgentStatus, lines: [] };
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agent]: {
            ...existing,
            lines: [...existing.lines, ...event.lines].slice(-20),
          },
        },
      };
    }

    case 'agent:error': {
      const existing = state.agents[event.agent] ?? { name: event.agent, status: 'error' as AgentStatus, lines: [] };
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agent]: {
            ...existing,
            status: 'error',
            lastError: event.error,
            lines: [...existing.lines, `ERROR: ${event.error}`].slice(-20),
          },
        },
      };
    }

    case 'git:merge:conflict': {
      const existing = state.agents[event.agent] ?? { name: event.agent, status: 'error' as AgentStatus, lines: [] };
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agent]: {
            ...existing,
            status: 'error',
            lastError: `Merge conflict: ${event.files.join(', ')}`,
            lines: [...existing.lines, `MERGE CONFLICT: ${event.files.join(', ')}`].slice(-20),
          },
        },
      };
    }

    default:
      return state;
  }
}

export function createInitialTuiState(bus: TriAgentEventBus, agentNames: string[]): TuiState {
  let state: TuiState = {
    phase: 'init',
    tasks: [],
    agents: createInitialAgents(agentNames),
  };

  for (const entry of bus.getEventLog()) {
    state = reduceTuiState(state, entry.event);
  }

  return state;
}

export function useTriAgentState(bus: TriAgentEventBus, agentNames: string[]): TuiState {
  const [state, setState] = useState<TuiState>(() => createInitialTuiState(bus, agentNames));

  useEffect(() => {
    setState(createInitialTuiState(bus, agentNames));

    const handler = (event: TriAgentEvent) => {
      setState((current) => reduceTuiState(current, event));
    };

    const eventTypes: TriAgentEvent['type'][] = [
      'task:created',
      'task:assigned',
      'task:started',
      'task:completed',
      'task:failed',
      'agent:output',
      'agent:status',
      'agent:error',
      'git:merge:conflict',
      'session:phase',
    ];

    for (const eventType of eventTypes) {
      bus.on(eventType, handler as never);
    }

    return () => {
      for (const eventType of eventTypes) {
        bus.off(eventType, handler as never);
      }
    };
  }, [bus, agentNames]);

  return state;
}
