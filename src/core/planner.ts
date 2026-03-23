import type { SubTask } from '../types.js';

type DomainName = 'frontend' | 'backend' | 'testing' | 'ci-cd' | 'docs' | 'config';

interface DomainDefinition {
  keywords: string[];
  pathHints: string[];
  taskLabel: string;
}

const DOMAIN_DEFINITIONS: Record<DomainName, DomainDefinition> = {
  frontend: {
    keywords: ['react', 'component', 'ui', 'css', 'html', 'page', 'form', 'dashboard', 'layout', 'style', 'design', 'navbar', 'sidebar', 'modal', 'button', 'frontend', 'next.js', 'tailwind', 'view', 'client'],
    pathHints: ['src/components/App.tsx', 'src/frontend/index.tsx', 'app/page.tsx', 'pages/index.tsx'],
    taskLabel: 'frontend implementation',
  },
  backend: {
    keywords: ['api', 'endpoint', 'route', 'middleware', 'database', 'db', 'schema', 'model', 'migration', 'server', 'auth', 'jwt', 'token', 'session', 'controller', 'service', 'backend', 'fastapi', 'express', 'rest', 'graphql'],
    pathHints: ['src/api/index.ts', 'src/server/index.ts', 'server/app.ts', 'app/api/route.ts'],
    taskLabel: 'backend implementation',
  },
  testing: {
    keywords: ['test', 'spec', 'e2e', 'unit test', 'integration test', 'coverage', 'mock', 'fixture', 'vitest', 'jest', 'pytest', 'testing'],
    pathHints: ['tests/app.test.ts', 'src/__tests__/app.test.ts'],
    taskLabel: 'test coverage',
  },
  'ci-cd': {
    keywords: ['ci', 'cd', 'pipeline', 'github actions', 'deploy', 'docker', 'dockerfile', 'workflow', 'ci/cd', 'ci-cd'],
    pathHints: ['.github/workflows/ci.yml', 'Dockerfile'],
    taskLabel: 'CI/CD automation',
  },
  docs: {
    keywords: ['readme', 'documentation', 'docs', 'jsdoc', 'changelog', 'guide'],
    pathHints: ['README.md', 'docs/guide.md'],
    taskLabel: 'documentation',
  },
  config: {
    keywords: ['config', 'configuration', 'env', 'environment', 'setup', 'install', 'scaffold'],
    pathHints: ['package.json', '.env.example', 'tsconfig.json'],
    taskLabel: 'configuration',
  },
};

const DOMAIN_ORDER: DomainName[] = ['frontend', 'backend', 'testing', 'ci-cd', 'docs', 'config'];
const EXPLICIT_PATH_PATTERN = /(?:\.?[\w-]+\/)+[\w./-]+|README\.md|Dockerfile|package\.json|tsconfig\.json|vitest\.config\.[\w.]+|\.github\/[\w./-]+|\.env(?:\.[\w-]+)?/gi;
const SEGMENT_SPLITTER = /\s*(?:,|;|\band then\b|\bthen\b|\band\b|\bplus\b|\balso\b)\s*/gi;

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((score, keyword) => {
    if (keyword.includes('.') || keyword.includes('/')) {
      return score + (lower.includes(keyword) ? 1 : 0);
    }

    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return score + (new RegExp(`\\b${escaped}\\b`, 'i').test(text) ? 1 : 0);
  }, 0);
}

function scoreDomains(text: string): Array<{ domain: DomainName; score: number }> {
  return DOMAIN_ORDER.map((domain) => ({
    domain,
    score: countKeywordMatches(text, DOMAIN_DEFINITIONS[domain].keywords),
  })).sort((a, b) => b.score - a.score);
}

function classifyDomain(text: string): DomainName {
  const [best] = scoreDomains(text);
  return best && best.score > 0 ? best.domain : 'backend';
}

function inferDomains(text: string): DomainName[] {
  const scored = scoreDomains(text);
  const strongDomains = scored.filter(({ score }) => score > 0);

  if (strongDomains.length === 0) {
    return ['backend'];
  }

  const maxScore = strongDomains[0].score;
  return strongDomains
    .filter(({ score }) => score >= Math.max(1, maxScore - 1))
    .map(({ domain }) => domain);
}

function extractTargetPaths(text: string, domains: DomainName[]): string[] | undefined {
  const explicit = text.match(EXPLICIT_PATH_PATTERN)?.map((match) => match.replace(/[),.;:]+$/, '')) ?? [];
  const hints = domains.flatMap((domain) => DOMAIN_DEFINITIONS[domain].pathHints);
  const paths = [...new Set([...explicit, ...hints])];
  return paths.length > 0 ? paths : undefined;
}

function cleanSegment(segment: string): string {
  return segment
    .replace(/^\s*(implement|build|create|add|fix|update|write)\s+/i, (match) => match.trimEnd() + ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSegments(task: string): string[] {
  const segments = task
    .split(SEGMENT_SPLITTER)
    .map((segment) => cleanSegment(segment))
    .filter(Boolean);

  return segments.length > 0 ? segments : [cleanSegment(task)];
}

function buildGeneratedDescription(domain: DomainName, task: string): string {
  const label = DOMAIN_DEFINITIONS[domain].taskLabel;
  const normalizedTask = task.trim().replace(/[.]+$/, '');
  return `Implement ${label} for: ${normalizedTask}`;
}

function expandSegments(segments: string[], originalTask: string): Array<{ description: string; domain: DomainName; targetPaths?: string[] }> {
  if (segments.length > 1) {
    return segments.map((segment) => {
      const inferredDomains = inferDomains(segment);
      const domain = classifyDomain(segment);
      return {
        description: segment,
        domain,
        targetPaths: extractTargetPaths(segment, inferredDomains),
      };
    });
  }

  const inferredDomains = inferDomains(originalTask);
  if (inferredDomains.length <= 1) {
    const only = inferredDomains[0] ?? 'backend';
    return [{
      description: originalTask.trim(),
      domain: only,
      targetPaths: extractTargetPaths(originalTask, inferredDomains),
    }];
  }

  return inferredDomains
    .filter((domain) => domain !== 'testing')
    .map((domain) => ({
      description: buildGeneratedDescription(domain, originalTask),
      domain,
      targetPaths: extractTargetPaths(originalTask, [domain]),
    }));
}

let counter = 0;

export function decompose(task: string): SubTask[] {
  counter = 0;
  const normalizedTask = task.trim();
  const expanded = expandSegments(splitIntoSegments(normalizedTask), normalizedTask);

  const subtasks: SubTask[] = expanded.map((entry) => ({
    id: `task-${++counter}`,
    description: entry.description,
    domain: entry.domain,
    targetPaths: entry.targetPaths,
    dependsOn: [],
    status: 'pending',
  }));

  const hasImplementationTask = subtasks.some((entry) => entry.domain !== 'testing');
  const hasExplicitTestTask = subtasks.some((entry) => entry.domain === 'testing');

  if (hasImplementationTask && !hasExplicitTestTask) {
    const implementationIds = subtasks.filter((entry) => entry.domain !== 'testing').map((entry) => entry.id);
    subtasks.push({
      id: `task-${++counter}`,
      description: `Add or update tests for: ${normalizedTask}`,
      domain: 'testing',
      targetPaths: extractTargetPaths(normalizedTask, ['testing']),
      dependsOn: implementationIds,
      status: 'pending',
    });
  }

  for (const taskEntry of subtasks) {
    if (taskEntry.domain === 'testing' && taskEntry.dependsOn.length === 0) {
      taskEntry.dependsOn = subtasks
        .filter((entry) => entry.id !== taskEntry.id && entry.domain !== 'testing')
        .map((entry) => entry.id);
    }
  }

  return subtasks;
}
