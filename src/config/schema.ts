import { z } from 'zod';

const healthCheckSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
});

const agentConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).min(1),
  strengths: z.array(z.string()).min(1),
  max_concurrent: z.number().int().positive().default(1),
  health_check: healthCheckSchema,
  auth_check: healthCheckSchema.optional(),
});

export const configSchema = z.object({
  agents: z.record(z.string(), agentConfigSchema).refine(
    (agents) => Object.keys(agents).length > 0,
    { message: 'At least one agent must be configured' }
  ),
  git: z.object({
    worktree_dir: z.string().default('.triagent/worktrees'),
    branch_prefix: z.string().default('triagent/'),
    auto_merge: z.boolean().default(true),
    merge_strategy: z.enum(['sequential', 'manual']).default('sequential'),
  }),
  session: z.object({
    require_approval: z.boolean().default(true),
    log_dir: z.string().default('.triagent/logs'),
    state_dir: z.string().default('.triagent/sessions'),
    max_retries: z.number().int().nonnegative().default(2),
    task_timeout_ms: z.number().int().positive().default(300000),
    tui_refresh_ms: z.number().int().positive().default(100),
  }),
  domains: z.record(z.string(), z.string()).optional(),
});

export type ValidatedConfig = z.infer<typeof configSchema>;
