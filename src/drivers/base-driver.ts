import { spawn as cpSpawn } from 'node:child_process';
import type { TriAgentEventBus } from '../core/event-bus.js';

interface DriverOptions {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  bus: TriAgentEventBus;
  refreshMs: number;
  authErrorPatterns?: RegExp[];
}

export class BaseDriver {
  protected name: string;
  protected command: string;
  protected args: string[];
  protected cwd: string;
  protected bus: TriAgentEventBus;
  protected refreshMs: number;
  protected authErrorPatterns: RegExp[];
  protected process: { pid: number; kill: (signal?: string) => void } | null = null;
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: DriverOptions) {
    this.name = options.name;
    this.command = options.command;
    this.args = options.args;
    this.cwd = options.cwd;
    this.bus = options.bus;
    this.refreshMs = options.refreshMs;
    this.authErrorPatterns = options.authErrorPatterns ?? [
      /authentication required/i,
      /session expired/i,
      /please log in/i,
      /unauthorized/i,
    ];
  }

  async start(taskDescription: string): Promise<number> {
    const fullArgs = [...this.args, taskDescription].filter(Boolean);

    try {
      const pty = await import('node-pty');
      return await this.startWithPty(pty, fullArgs);
    } catch {
      return this.startWithSpawn(fullArgs);
    }
  }

  private startWithPty(pty: typeof import('node-pty'), fullArgs: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      let proc: ReturnType<typeof pty.spawn>;
      try {
        proc = pty.spawn(this.command, fullArgs, {
          name: 'xterm-256color',
          cwd: this.cwd,
          env: process.env as Record<string, string>,
        });
      } catch (err) {
        reject(err);
        return;
      }

      this.process = { pid: proc.pid, kill: (sig?: string) => proc.kill(sig) };
      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'working' });
      this.flushTimer = setInterval(() => this.flushBuffer(), this.refreshMs);

      proc.onData((data: string) => {
        const lines = data.split('\n').filter(Boolean);
        this.buffer.push(...lines);
        if (this.buffer.length > 500) this.buffer.splice(0, this.buffer.length - 500);
        this.checkAuthError(lines);
      });

      proc.onExit(({ exitCode: rawCode }) => {
        const exitCode = rawCode ?? 1;
        this.flushBuffer();
        if (this.flushTimer) clearInterval(this.flushTimer);

        if (exitCode !== 0) {
          this.bus.emit('agent:error', {
            type: 'agent:error', agent: this.name,
            error: `Process exited with code ${exitCode}`, isAuthError: false,
          });
        }

        this.bus.emit('agent:status', {
          type: 'agent:status', agent: this.name,
          status: exitCode === 0 ? 'done' : 'error',
        });

        resolve(exitCode);
      });
    });
  }

  private startWithSpawn(fullArgs: string[]): Promise<number> {
    return new Promise((resolve) => {
      const proc = cpSpawn(this.command, fullArgs, {
        cwd: this.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process = {
        pid: proc.pid!,
        kill: (sig?: string) => proc.kill(sig as NodeJS.Signals | undefined),
      };

      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'working' });
      this.flushTimer = setInterval(() => this.flushBuffer(), this.refreshMs);

      proc.stdout?.on('data', (d: Buffer) => {
        const lines = d.toString().split('\n').filter(Boolean);
        this.buffer.push(...lines);
        if (this.buffer.length > 500) this.buffer.splice(0, this.buffer.length - 500);
        this.checkAuthError(lines);
      });

      proc.stderr?.on('data', (d: Buffer) => {
        const lines = d.toString().split('\n').filter(Boolean);
        this.buffer.push(...lines);
        if (this.buffer.length > 500) this.buffer.splice(0, this.buffer.length - 500);
        this.checkAuthError(lines);
      });

      proc.on('close', (code: number | null) => {
        const exitCode = code ?? 1;
        this.flushBuffer();
        if (this.flushTimer) clearInterval(this.flushTimer);
        if (exitCode !== 0) {
          this.bus.emit('agent:error', {
            type: 'agent:error', agent: this.name,
            error: `Process exited with code ${exitCode}`, isAuthError: false,
          });
        }
        this.bus.emit('agent:status', {
          type: 'agent:status', agent: this.name,
          status: exitCode === 0 ? 'done' : 'error',
        });
        resolve(exitCode);
      });
    });
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;
    const lines = this.buffer.splice(0);
    this.bus.emit('agent:output', { type: 'agent:output', agent: this.name, lines });
  }

  private checkAuthError(lines: string[]): void {
    for (const line of lines) {
      for (const pattern of this.authErrorPatterns) {
        if (pattern.test(line)) {
          this.bus.emit('agent:error', {
            type: 'agent:error', agent: this.name,
            error: `Auth error detected: ${line}`, isAuthError: true,
          });
          return;
        }
      }
    }
  }

  pause(): void {
    if (this.process?.pid) {
      process.kill(this.process.pid, 'SIGSTOP');
      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'paused' });
    }
  }

  resume(): void {
    if (this.process?.pid) {
      process.kill(this.process.pid, 'SIGCONT');
      this.bus.emit('agent:status', { type: 'agent:status', agent: this.name, status: 'working' });
    }
  }

  kill(): void {
    if (this.process?.pid) {
      process.kill(this.process.pid, 'SIGTERM');
    }
  }
}
