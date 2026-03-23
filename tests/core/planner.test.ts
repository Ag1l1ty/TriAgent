import { describe, it, expect } from 'vitest';
import { decompose } from '../../src/core/planner.js';

describe('Planner', () => {
  it('should generate actionable subtasks for multi-domain requests', () => {
    const tasks = decompose('Implement user authentication with JWT and build a React login form');

    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(tasks.some((task) => task.domain === 'backend')).toBe(true);
    expect(tasks.some((task) => task.domain === 'frontend')).toBe(true);
    expect(tasks.some((task) => task.domain === 'testing')).toBe(true);
    expect(tasks.some((task) => task.description.startsWith('Implement backend implementation for:'))).toBe(false);
  });

  it('should create a testing task that depends on implementation work', () => {
    const tasks = decompose('Build frontend and backend');
    const testTask = tasks.find((task) => task.domain === 'testing');

    expect(testTask).toBeDefined();
    expect(testTask?.dependsOn.length).toBe(2);
  });

  it('should infer useful target paths from explicit file mentions', () => {
    const tasks = decompose('Update src/api/auth.ts and tests/auth.test.ts for JWT auth');

    expect(tasks.some((task) => task.targetPaths?.includes('src/api/auth.ts'))).toBe(true);
    expect(tasks.some((task) => task.targetPaths?.includes('tests/auth.test.ts'))).toBe(true);
  });

  it('should infer path hints for docs and config tasks', () => {
    const tasks = decompose('Update README documentation and setup environment config');
    const docsTask = tasks.find((task) => task.domain === 'docs');
    const configTask = tasks.find((task) => task.domain === 'config');

    expect(docsTask?.targetPaths).toContain('README.md');
    expect(configTask?.targetPaths).toContain('.env.example');
  });

  it('should assign unique IDs', () => {
    const tasks = decompose('Build API endpoints and frontend forms');
    const ids = tasks.map((task) => task.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
