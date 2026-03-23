import { describe, it, expect } from 'vitest';
import { decompose } from '../../src/core/planner.js';

describe('Planner', () => {
  it('should decompose a full-stack task into subtasks', () => {
    const tasks = decompose('Implement user authentication with JWT');
    expect(tasks.length).toBeGreaterThan(1);
    const domains = tasks.map((t) => t.domain);
    expect(domains).toContain('backend');
  });

  it('should set dependencies for testing tasks', () => {
    const tasks = decompose('Add login page with form validation and tests');
    const testTask = tasks.find((t) => t.domain === 'testing');
    if (testTask) {
      expect(testTask.dependsOn.length).toBeGreaterThan(0);
    }
  });

  it('should tag frontend tasks correctly', () => {
    const tasks = decompose('Create a React dashboard with charts');
    const frontendTasks = tasks.filter((t) => t.domain === 'frontend');
    expect(frontendTasks.length).toBeGreaterThan(0);
  });

  it('should handle single-domain tasks', () => {
    const tasks = decompose('Fix the CSS styling on the navbar');
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].domain).toBe('frontend');
  });

  it('should assign unique IDs', () => {
    const tasks = decompose('Build API endpoints and frontend forms');
    const ids = tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
