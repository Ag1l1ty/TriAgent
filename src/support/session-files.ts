import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TriAgentConfig, SubTask, SessionPhase, TriAgentEvent } from '../types.js';

export interface SessionSnapshotRecord {
  sessionId: string;
  phase: SessionPhase;
  task: string;
  subtasks: SubTask[];
  updatedAt: string;
}

export interface SessionEventRecord {
  timestamp: string;
  event: TriAgentEvent;
}

function getStateDir(repoDir: string, config: TriAgentConfig): string {
  return join(repoDir, config.session.state_dir);
}

function getLogDir(repoDir: string, config: TriAgentConfig): string {
  return join(repoDir, config.session.log_dir);
}

export function listSessionIds(repoDir: string, config: TriAgentConfig): string[] {
  const stateDir = getStateDir(repoDir, config);
  if (!existsSync(stateDir)) {
    return [];
  }

  return readdirSync(stateDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5))
    .sort();
}

export function readSessionSnapshot(repoDir: string, config: TriAgentConfig, sessionId: string): SessionSnapshotRecord | null {
  const snapshotPath = join(getStateDir(repoDir, config), `${sessionId}.json`);
  if (!existsSync(snapshotPath)) {
    return null;
  }

  return JSON.parse(readFileSync(snapshotPath, 'utf-8')) as SessionSnapshotRecord;
}

export function getLatestSessionId(repoDir: string, config: TriAgentConfig): string | null {
  const sessions = listSessionIds(repoDir, config)
    .map((sessionId) => readSessionSnapshot(repoDir, config, sessionId))
    .filter((snapshot): snapshot is SessionSnapshotRecord => snapshot !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return sessions[0]?.sessionId ?? null;
}

export function readSessionEvents(repoDir: string, config: TriAgentConfig, sessionId: string): SessionEventRecord[] {
  const logPath = join(getLogDir(repoDir, config), `${sessionId}.jsonl`);
  if (!existsSync(logPath)) {
    return [];
  }

  return readFileSync(logPath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEventRecord);
}

export function summarizeTaskStatus(subtasks: SubTask[]): Record<string, number> {
  return subtasks.reduce<Record<string, number>>((summary, task) => {
    summary[task.status] = (summary[task.status] ?? 0) + 1;
    return summary;
  }, {});
}
