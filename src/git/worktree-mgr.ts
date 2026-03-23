import { simpleGit, SimpleGit } from 'simple-git';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { makeBranchName } from './branch.js';

interface WorktreeManagerOptions {
  repoDir: string;
  worktreeDir: string;
  branchPrefix: string;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  agent: string;
  sessionId?: string;
}

export class WorktreeManager {
  private git: SimpleGit;
  private worktreeDir: string;
  private branchPrefix: string;

  constructor(options: WorktreeManagerOptions) {
    this.git = simpleGit(options.repoDir);
    this.worktreeDir = options.worktreeDir;
    this.branchPrefix = options.branchPrefix;
  }

  async create(agent: string, sessionId: string): Promise<WorktreeInfo> {
    const branch = makeBranchName(this.branchPrefix, agent, sessionId);
    const path = join(this.worktreeDir, sessionId, agent);

    await mkdir(join(this.worktreeDir, sessionId), { recursive: true });

    await this.git.raw(['worktree', 'add', '-b', branch, path]);

    return { path, branch, agent };
  }

  async remove(agent: string, sessionId: string, options: { deleteBranch?: boolean } = {}): Promise<void> {
    const path = join(this.worktreeDir, sessionId, agent);
    const branch = makeBranchName(this.branchPrefix, agent, sessionId);
    const deleteBranch = options.deleteBranch ?? true;

    await this.git.raw(['worktree', 'remove', path, '--force']);
    if (deleteBranch) {
      await this.git.raw(['branch', '-D', branch]).catch(() => {});
    }
  }

  async list(): Promise<WorktreeInfo[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];

    const blocks = result.trim().split('\n\n');
    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));
      if (pathLine && branchLine) {
        const wtPath = pathLine.replace('worktree ', '');
        const fullBranch = branchLine.replace('branch refs/heads/', '');
        if (fullBranch.startsWith(this.branchPrefix)) {
          const fallback = fullBranch.replace(this.branchPrefix, '');
          const separator = fallback.indexOf('-');
          const agent = separator >= 0 ? fallback.slice(0, separator) : fallback;
          const sessionId = separator >= 0 ? fallback.slice(separator + 1) : undefined;
          worktrees.push({ path: wtPath, branch: fullBranch, agent, sessionId });
        }
      }
    }

    return worktrees;
  }
}
