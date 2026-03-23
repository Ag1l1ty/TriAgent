#!/usr/bin/env node

import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { VERSION } from './index.js';
import { loadConfig } from './config/loader.js';
import { Session } from './core/session.js';
import { TriAgentEventBus } from './core/event-bus.js';

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

    const plan = session.plan();
    console.log('\nProposed plan:');
    for (const t of plan) {
      console.log(`  [${t.assignedTo ?? '?'}] ${t.description}`);
    }

    if (config.session.require_approval) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) => {
        rl.question('\nApprove plan? (y/n): ', resolve);
      });
      rl.close();
      if (answer.toLowerCase() !== 'y') {
        console.log('Plan rejected. Exiting.');
        process.exit(0);
      }
    }

    console.log('Session started. Executing plan...');
    await session.setup();
    await session.execute();
    await session.merge();
    console.log('Session complete.');
  });

program
  .command('status')
  .description('Check agent availability and health')
  .action(async () => {
    const configPath = join(process.cwd(), 'triagent.config.yaml');
    const config = await loadConfig(configPath);

    for (const [name, agent] of Object.entries(config.agents)) {
      let pathOk = false;
      let healthOk = false;

      try {
        execFileSync('which', [agent.command], { stdio: 'pipe' });
        pathOk = true;
      } catch { /* not found */ }

      if (pathOk && agent.health_check) {
        try {
          execFileSync(agent.health_check.command, agent.health_check.args, { stdio: 'pipe', timeout: 10000 });
          healthOk = true;
        } catch { /* health check failed */ }
      }

      const pathIcon = pathOk ? '✓' : '✗';
      const healthIcon = healthOk ? '✓' : '✗';
      console.log(`  ${name}: PATH ${pathIcon}  HEALTH ${healthIcon}`);
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
  .action(() => {
    console.log('Logs not yet implemented.');
  });

program
  .command('cleanup')
  .description('Remove stale worktrees')
  .action(() => {
    try {
      execFileSync('git', ['worktree', 'prune'], { stdio: 'pipe' });
      console.log('Worktrees pruned.');
    } catch (err) {
      console.error('Failed to prune worktrees:', (err as Error).message);
    }
  });

program.parse();
