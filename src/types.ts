// Agent identification
export type AgentName = string; // Known values: 'claude' | 'forge' | 'codex'
export type AgentStatus = 'idle' | 'working' | 'paused' | 'error' | 'done';
export type SessionPhase = 'init' | 'plan' | 'setup' | 'execute' | 'merge' | 'complete';

// Sub-task
export interface SubTask {
  id: string;
  description: string;
  domain: string;
  targetPaths?: string[];
  dependsOn: string[];
  assignedTo?: AgentName;
  status: 'pending' | 'running' | 'done' | 'failed';
}

// Config interfaces
export interface HealthCheck {
  command: string;
  args: string[];
}

export interface AgentConfig {
  command: string;
  args: string[];
  strengths: string[];
  max_concurrent: number;
  health_check: HealthCheck;       // Structured to prevent shell injection
  auth_check?: HealthCheck;        // Structured to prevent shell injection
}

export interface TriAgentConfig {
  agents: Record<string, AgentConfig>;
  git: {
    worktree_dir: string;
    branch_prefix: string;
    auto_merge: boolean;
    merge_strategy: 'sequential' | 'manual';
  };
  session: {
    require_approval: boolean;
    log_dir: string;
    state_dir: string;
    max_retries: number;
    task_timeout_ms: number;
    tui_refresh_ms: number;
  };
  domains?: Record<string, string>;
}

// Event system
export type TriAgentEvent =
  | { type: 'task:created'; task: SubTask }
  | { type: 'task:assigned'; task: SubTask; agent: AgentName }
  | { type: 'task:started'; taskId: string; agent: AgentName }
  | { type: 'task:completed'; taskId: string; agent: AgentName }
  | { type: 'task:failed'; taskId: string; agent: AgentName; error: string }
  | { type: 'agent:output'; agent: AgentName; lines: string[] } // NOTE: spec says `line: string`, changed to `lines: string[]` for buffered flush (circular buffer design)
  | { type: 'agent:status'; agent: AgentName; status: AgentStatus }
  | { type: 'agent:error'; agent: AgentName; error: string; isAuthError: boolean }
  | { type: 'git:worktree:created'; agent: AgentName; path: string; branch: string }
  | { type: 'git:merge:start'; agent: AgentName }
  | { type: 'git:merge:success'; agent: AgentName }
  | { type: 'git:merge:conflict'; agent: AgentName; files: string[] }
  | { type: 'session:phase'; phase: SessionPhase };

// Utility: extract event by type
export type EventOfType<T extends TriAgentEvent['type']> = Extract<TriAgentEvent, { type: T }>;
