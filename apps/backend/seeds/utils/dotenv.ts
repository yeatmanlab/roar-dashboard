/**
 * Dotenv file utilities for seed scripts.
 *
 * Shared between setup (writes FGA IDs) and any future scripts that need
 * to persist environment variables to the active dotenv file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChildLogger } from '../../src/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = createChildLogger({}, { msgPrefix: '[dotenv] ' });

/**
 * Resolve the active dotenv file path.
 *
 * Uses `DOTENV_CONFIG_PATH` when set (CI points this to `.env.test`),
 * otherwise defaults to `.env` in the package root (`apps/backend/`).
 */
export function resolveEnvFilePath(): string {
  if (process.env.DOTENV_CONFIG_PATH) {
    return path.resolve(process.env.DOTENV_CONFIG_PATH);
  }
  // seeds/utils/ → seeds/ → apps/backend/
  return path.resolve(__dirname, '..', '..', '.env');
}

/**
 * Upsert key=value pairs in the active dotenv file.
 *
 * Replaces existing lines for each key; appends any keys that aren't already
 * present. Safe to call on repeated runs — values are updated in place
 * rather than duplicated.
 *
 * @param vars - Key-value pairs to write (e.g. `{ FGA_STORE_ID: '...' }`)
 */
export function upsertEnvVars(vars: Record<string, string>): void {
  const envPath = resolveEnvFilePath();

  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (pattern.test(content)) {
      content = content.replace(pattern, line);
    } else {
      content = content.trimEnd() + '\n' + line + '\n';
    }
  }

  fs.writeFileSync(envPath, content);
  logger.info({ path: envPath, keys: Object.keys(vars) }, 'Wrote env vars to dotenv file');
}
