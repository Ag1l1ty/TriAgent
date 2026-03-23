#!/usr/bin/env node

import React from 'react';
import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { render } from 'ink';
import { VERSION } from './index.js';
import { loadConfig } from './config/loader.js';
import { Session } from './core/session.js';
import { TriAgentEventBus } from './core/event-bus.js';
import { App } from './tui/app.js';
import { WorktreeManager } from './git/worktree-mgr.js';
import { collectDoctorReport } from './support/doctor.js';
import { getLatestSessionId, readSessionEvents, readSessionSnapshot, summarizeTaskStatus } from './support/session-files.js';

function runStructuredCheck(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

const program = new Command();
program.name('triagent').version(VERSION).description('CLI orchestrator for AI coding agents');

program
  .command('start')
  .description('Start a session with the given task')
  .argument('<task>', 'Task description for agents')
  .action(async (task: string) => {
    const configPath = join(process.cwd(), 'triagent.config.yaml');
    const config = await loadConfig(configPath);
    const bus = new TriAgentEventBus({ logging: true });
    const session = new Session({ config, bus, repoDir: process.cwd(), task });
    const isInteractiveTerminal = Boolean(process.stdout.isTTY && process.stdin.isTTY);
    const agentNames = Object.keys(config.agents);
    const appRef: { current: { unmount: () => void } | null } = { current: null };

    const plan = session.plan();

    let approved = true;
    if (isInteractiveTerminal) {
      approved = await new Promise<boolean>((resolve) => {
        appRef.current = render(
          React.createElement(App, {
            bus,
            agents: agentNames,
            requiresApproval: config.session.require_approval,
            onApprove: () => resolve(true),
            onReject: () => resolve(false),
          })
        );

        if (!config.session.require_approval) {
          resolve(true);
        }
      });
    } else {
      console.log('\nProposed plan:');
      for (const t of plan) {
        console.log(`  [${t.assignedTo ?? '?'}] ${t.description}`);
      }
    }

    if (!isInteractiveTerminal && config.session.require_approval) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) => {
        rl.question('\nApprove plan? (y/n): ', resolve);
      });
      rl.close();
      approved = answer.toLowerCase() === 'y';
    }

    if (!approved) {
      appRef.current?.unmount();
      console.log('Plan rejected. Exiting.');
      process.exit(0);
    }

    if (!isInteractiveTerminal) {
      console.log(`Session ${session.getSessionId()} started. Executing plan...`);
    }

    try {
      await session.setup();
      await session.execute();
      await session.merge();
      appRef.current?.unmount();
      console.log(`Session ${session.getSessionId()} complete.`);
    } catch (err) {
      appRef.current?.unmount();
      console.error(`Session ${session.getSessionId()} failed:`, (err as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command('status')
  .description('Check agent availability and health')
  .action(async () => {
    const configPath = join(process.cwd(), 'triagent.config.yaml');
    const config = await loadConfig(configPath);
    const report = await collectDoctorReport(process.cwd(), config);

    for (const agent of report.agents) {
      const pathIcon = agent.pathOk ? '✓' : '✗';
      const healthIcon = agent.healthOk ? '✓' : '✗';
      const authIcon = agent.authOk === null ? '-' : (agent.authOk ? '✓' : '✗');
      console.log(`  ${agent.name}: PATH ${pathIcon}  HEALTH ${healthIcon}  AUTH ${authIcon}`);
    }
  });

program
  .command('init')
  .description('Create triagent.config.yaml in current directory')
  .action(() => {
    const dest = join(process.cwd(), 'triagent.config.yaml');
    if (existsSync(dest)) {
      console.log('triagent.config.yaml already exists.');
      return;
    }
    const src = join(import.meta.dirname, '..', 'triagent.config.example.yaml');
    copyFileSync(src, dest);
    console.log('Created triagent.config.yaml');
  });

program
  .command('logs')
  .description('Show session logs')
  .argument('[sessionId]', 'Session ID')
  .option('-n, --tail <count>', 'Number of recent events to show', '20')
  .action(async (sessionId: string | undefined, options: { tail: string }) => {
    const configPath = join(process.cwd(), 'triagent.config.yaml');
    const config = await loadConfig(configPath);
    const resolvedSessionId = sessionId ?? getLatestSessionId(process.cwd(), config);

    if (!resolvedSessionId) {
      console.log('No TriAgent sessions found.');
      process.exitCode = 1;
      return;
    }

    const snapshot = readSessionSnapshot(process.cwd(), config, resolvedSessionId);
    if (!snapshot) {
      console.log(`Session ${resolvedSessionId} not found.`);
      process.exitCode = 1;
      return;
    }

    const events = readSessionEvents(process.cwd(), config, resolvedSessionId);
    const tailCount = Math.max(1, Number.parseInt(options.tail, 10) || 20);
    const recentEvents = events.slice(-tailCount);
    const statusSummary = summarizeTaskStatus(snapshot.subtasks);

    console.log(`Session: ${snapshot.sessionId}`);
    console.log(`Phase: ${snapshot.phase.toUpperCase()}`);
    console.log(`Updated: ${snapshot.updatedAt}`);
    console.log(`Task: ${snapshot.task}`);
    console.log(`Task Status: ${Object.entries(statusSummary).map(([status, count]) => `${status}=${count}`).join('  ') || 'none'}`);
    console.log('\nSubtasks:');
    for (const task of snapshot.subtasks) {
      console.log(`  [${task.status}] [${task.assignedTo ?? '?'}] ${task.description}`);
    }

    console.log(`\nRecent Events (${recentEvents.length}/${events.length}):`);
    for (const entry of recentEvents) {
      const details = formatEventDetails(entry.event);
      console.log(`  ${entry.timestamp}  ${entry.event.type}${details ? `  ${details}` : ''}`);
    }
  });

program
  .command('doctor')
  .description('Run repository and agent diagnostics')
  .action(async () => {
    const configPath = join(process.cwd(), 'triagent.config.yaml');
    const config = await loadConfig(configPath);
    const report = await collectDoctorReport(process.cwd(), config);

    console.log(`Repo: ${report.repoDir}`);
    console.log(`Git Repo: ${report.isGitRepo ? 'yes' : 'no'}`);
    console.log(`Config File: ${report.configPresent ? 'present' : 'using defaults or missing local config'}`);
    console.log(`Log Dir: ${report.logDirPresent ? 'present' : 'missing'}`);
    console.log(`State Dir: ${report.stateDirPresent ? 'present' : 'missing'}`);
    console.log(`Sessions: ${report.sessionCount}`);
    console.log(`Active Worktrees: ${report.worktreeCount}`);
    console.log('\nAgents:');

    for (const agent of report.agents) {
      const authLabel = agent.authOk === null ? 'n/a' : (agent.authOk ? 'ok' : 'fail');
      console.log(`  ${agent.name}: path=${agent.pathOk ? 'ok' : 'fail'} health=${agent.healthOk ? 'ok' : 'fail'} auth=${authLabel}`);
    }
  });

program
  .command('cleanup')
  .description('Remove stale worktrees')
  .action(async () => {
    try {
      const configPath = join(process.cwd(), 'triagent.config.yaml');
      const config = await loadConfig(configPath);
      const mgr = new WorktreeManager({
        repoDir: process.cwd(),
        worktreeDir: join(process.cwd(), config.git.worktree_dir),
        branchPrefix: config.git.branch_prefix,
      });
      const worktrees = await mgr.list();

      for (const worktree of worktrees) {
        if (worktree.sessionId) {
          await mgr.remove(worktree.agent, worktree.sessionId, { deleteBranch: true });
        }
      }

      execFileSync('git', ['worktree', 'prune'], { stdio: 'pipe' });
      console.log(`Removed ${worktrees.length} TriAgent worktree(s) and pruned Git worktrees.`);
    } catch (err) {
      console.error('Failed to prune worktrees:', (err as Error).message);
    }
  });

program.parse();

function formatEventDetails(event: { type: string } & Record<string, unknown>): string {
  switch (event.type) {
    case 'task:started':
    case 'task:completed':
      return `task=${String(event.taskId)} agent=${String(event.agent)}`;
    case 'task:failed':
      return `task=${String(event.taskId)} agent=${String(event.agent)} error=${String(event.error)}`;
    case 'agent:error':
      return `agent=${String(event.agent)} error=${String(event.error)}`;
    case 'agent:status':
      return `agent=${String(event.agent)} status=${String(event.status)}`;
    case 'git:merge:conflict':
      return `agent=${String(event.agent)} files=${Array.isArray(event.files) ? event.files.join(',') : ''}`;
    case 'git:worktree:created':
      return `agent=${String(event.agent)} branch=${String(event.branch)}`;
    case 'session:phase':
      return `phase=${String(event.phase)}`;
    case 'agent:output':
      return `agent=${String(event.agent)} lines=${Array.isArray(event.lines) ? event.lines.length : 0}`;
    default:
      return '';
  }
}
