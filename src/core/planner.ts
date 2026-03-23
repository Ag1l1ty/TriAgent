import type { SubTask } from '../types.js';

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: ['react', 'component', 'ui', 'css', 'html', 'page', 'form', 'dashboard', 'layout', 'style', 'design', 'navbar', 'sidebar', 'modal', 'button', 'frontend', 'next.js', 'tailwind', 'view'],
  backend: ['api', 'endpoint', 'route', 'middleware', 'database', 'db', 'schema', 'model', 'migration', 'server', 'auth', 'jwt', 'token', 'session', 'controller', 'service', 'backend', 'fastapi', 'express', 'rest', 'graphql'],
  testing: ['test', 'spec', 'e2e', 'unit test', 'integration test', 'coverage', 'mock', 'fixture', 'vitest', 'jest', 'pytest', 'testing'],
  'ci-cd': ['ci', 'cd', 'pipeline', 'github actions', 'deploy', 'docker', 'dockerfile', 'workflow', 'ci/cd', 'ci-cd'],
  docs: ['readme', 'documentation', 'docs', 'jsdoc', 'changelog', 'guide'],
  config: ['config', 'configuration', 'env', 'environment', 'setup', 'install', 'scaffold'],
};

function classifyDomain(text: string): string {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    scores[domain] = keywords.filter((k) => lower.includes(k)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'backend';
}

function splitIntoSegments(task: string): string[] {
  const connectors = /\b(and then|and|with|plus|also|then)\b/gi;
  const segments = task.split(connectors).filter((s) => !connectors.test(s) && s.trim());

  if (segments.length <= 1) {
    const domains = new Set<string>();
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      if (keywords.some((k) => task.toLowerCase().includes(k))) {
        domains.add(domain);
      }
    }
    if (domains.size > 1) {
      return [...domains].map((d) => `${d}: ${task}`);
    }
  }

  return segments.length > 0 ? segments.map((s) => s.trim()) : [task];
}

let counter = 0;

export function decompose(task: string): SubTask[] {
  counter = 0;
  const segments = splitIntoSegments(task);
  const subtasks: SubTask[] = segments.map((seg) => ({
    id: `task-${++counter}`,
    description: seg.trim(),
    domain: classifyDomain(seg),
    dependsOn: [],
    status: 'pending',
  }));

  const hasTestTask = subtasks.some((t) => t.domain === 'testing');
  if (!hasTestTask && subtasks.length > 1) {
    const implIds = subtasks.map((t) => t.id);
    subtasks.push({
      id: `task-${++counter}`,
      description: `Write tests for: ${task}`,
      domain: 'testing',
      dependsOn: implIds,
      status: 'pending',
    });
  }

  for (const t of subtasks) {
    if (t.domain === 'testing' && t.dependsOn.length === 0) {
      t.dependsOn = subtasks.filter((s) => s.domain !== 'testing').map((s) => s.id);
    }
  }

  return subtasks;
}
