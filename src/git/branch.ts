export function makeBranchName(prefix: string, agent: string, sessionId: string): string {
  return `${prefix}${agent}-${sessionId}`;
}

export function isTriAgentBranch(branchName: string, prefix: string): boolean {
  return branchName.startsWith(prefix);
}
