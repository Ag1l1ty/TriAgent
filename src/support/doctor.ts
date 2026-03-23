import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TriAgentConfig } from '../types.js';
import { WorktreeManager } from '../git/worktree-mgr.js';
import { listSessionIds } from './session-files.js';

export interface AgentDoctorStatus {
  name: string;
  pathOk: boolean;
  healthOk: boolean;
  authOk: boolean | null;
}

export interface DoctorReport {
  repoDir: string;
  isGitRepo: boolean;
  configPresent: boolean;
  logDirPresent: boolean;
  stateDirPresent: boolean;
  sessionCount: number;
  worktreeCount: number;
  agents: AgentDoctorStatus[];
}

function runStructuredCheck(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

function isGitRepo(repoDir: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoDir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function collectDoctorReport(repoDir: string, config: TriAgentConfig): Promise<DoctorReport> {
  const gitRepo = isGitRepo(repoDir);
  const configPresent = existsSync(join(repoDir, 'triagent.config.yaml'));
  const logDirPresent = existsSync(join(repoDir, config.session.log_dir));
  const stateDirPresent = existsSync(join(repoDir, config.session.state_dir));
  const sessionCount = listSessionIds(repoDir, config).length;

  let worktreeCount = 0;
  if (gitRepo) {
    const mgr = new WorktreeManager({
      repoDir,
      worktreeDir: join(repoDir, config.git.worktree_dir),
      branchPrefix: config.git.branch_prefix,
    });
    worktreeCount = (await mgr.list()).length;
  }

  const agents: AgentDoctorStatus[] = Object.entries(config.agents).map(([name, agent]) => {
    let pathOk = false;

    try {
      execFileSync('which', [agent.command], { stdio: 'pipe' });
      pathOk = true;
    } catch {
      pathOk = false;
    }

    const healthOk = pathOk ? runStructuredCheck(agent.health_check.command, agent.health_check.args) : false;
    const authOk = agent.auth_check ? (pathOk ? runStructuredCheck(agent.auth_check.command, agent.auth_check.args) : false) : null;

    return {
      name,
      pathOk,
      healthOk,
      authOk,
    };
  });

  return {
    repoDir,
    isGitRepo: gitRepo,
    configPresent,
    logDirPresent,
    stateDirPresent,
    sessionCount,
    worktreeCount,
    agents,
  };
}
