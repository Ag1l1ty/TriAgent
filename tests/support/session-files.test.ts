import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { getLatestSessionId, listSessionIds, readSessionEvents, readSessionSnapshot, summarizeTaskStatus } from '../../src/support/session-files.js';

describe('session-files', () => {
  const baseDir = join(tmpdir(), `triagent-session-files-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(baseDir, '.triagent', 'logs'), { recursive: true });
    mkdirSync(join(baseDir, '.triagent', 'sessions'), { recursive: true });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('should list and resolve latest session snapshots', () => {
    writeFileSync(join(baseDir, '.triagent', 'sessions', 'a.json'), JSON.stringify({
      sessionId: 'a',
      phase: 'plan',
      task: 'First',
      subtasks: [],
      updatedAt: '2026-03-22T00:00:00.000Z',
    }));
    writeFileSync(join(baseDir, '.triagent', 'sessions', 'b.json'), JSON.stringify({
      sessionId: 'b',
      phase: 'complete',
      task: 'Second',
      subtasks: [],
      updatedAt: '2026-03-23T00:00:00.000Z',
    }));

    expect(listSessionIds(baseDir, DEFAULT_CONFIG)).toEqual(['a', 'b']);
    expect(getLatestSessionId(baseDir, DEFAULT_CONFIG)).toBe('b');
  });

  it('should read snapshots and event logs', () => {
    writeFileSync(join(baseDir, '.triagent', 'sessions', 'session-1.json'), JSON.stringify({
      sessionId: 'session-1',
      phase: 'execute',
      task: 'Build feature',
      subtasks: [{ id: 't1', description: 'Task 1', domain: 'backend', dependsOn: [], status: 'running', assignedTo: 'forge' }],
      updatedAt: '2026-03-23T12:00:00.000Z',
    }));
    writeFileSync(join(baseDir, '.triagent', 'logs', 'session-1.jsonl'), [
      JSON.stringify({ timestamp: '2026-03-23T12:00:00.000Z', event: { type: 'session:phase', phase: 'execute' } }),
      JSON.stringify({ timestamp: '2026-03-23T12:00:01.000Z', event: { type: 'task:started', taskId: 't1', agent: 'forge' } }),
    ].join('\n'));

    const snapshot = readSessionSnapshot(baseDir, DEFAULT_CONFIG, 'session-1');
    const events = readSessionEvents(baseDir, DEFAULT_CONFIG, 'session-1');

    expect(snapshot?.task).toBe('Build feature');
    expect(events.length).toBe(2);
    expect(events[1]?.event.type).toBe('task:started');
  });

  it('should summarize subtask status counts', () => {
    const summary = summarizeTaskStatus([
      { id: 't1', description: 'A', domain: 'backend', dependsOn: [], status: 'done' },
      { id: 't2', description: 'B', domain: 'frontend', dependsOn: [], status: 'done' },
      { id: 't3', description: 'C', domain: 'testing', dependsOn: [], status: 'failed' },
    ]);

    expect(summary.done).toBe(2);
    expect(summary.failed).toBe(1);
  });
});
