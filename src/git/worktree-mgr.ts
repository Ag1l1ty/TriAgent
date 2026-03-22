import { simpleGit, SimpleGit } from 'simple-git';
import { join } from 'node:path';
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
    const path = join(this.worktreeDir, agent);

    await this.git.raw(['worktree', 'add', '-b', branch, path]);

    return { path, branch, agent };
  }

  async remove(agent: string, sessionId: string): Promise<void> {
    const path = join(this.worktreeDir, agent);
    const branch = makeBranchName(this.branchPrefix, agent, sessionId);

    await this.git.raw(['worktree', 'remove', path, '--force']);
    await this.git.raw(['branch', '-D', branch]).catch(() => {});
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
          const agent = fullBranch.replace(this.branchPrefix, '').split('-')[0];
          worktrees.push({ path: wtPath, branch: fullBranch, agent });
        }
      }
    }

    return worktrees;
  }
}
