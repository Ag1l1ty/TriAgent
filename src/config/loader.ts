import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import YAML from 'yaml';
import { configSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { TriAgentConfig } from '../types.js';

export async function loadConfig(configPath: string): Promise<TriAgentConfig> {
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = await readFile(configPath, 'utf-8');
  const parsed = YAML.parse(raw);
  const validated = configSchema.parse(parsed);
  return validated as TriAgentConfig;
}
