import { simpleGit } from 'simple-git';

interface MergeResult {
  success: boolean;
  conflicts: string[];
}

export async function mergeAgentBranch(repoDir: string, branch: string): Promise<MergeResult> {
  const git = simpleGit(repoDir);

  try {
    await git.merge([branch, '--no-ff']);
    return { success: true, conflicts: [] };
  } catch {
    const status = await git.status();
    const conflicts = status.conflicted;

    if (conflicts.length > 0) {
      await git.merge(['--abort']);
      return { success: false, conflicts };
    }

    throw new Error(`Merge of ${branch} failed for unknown reason`);
  }
}
