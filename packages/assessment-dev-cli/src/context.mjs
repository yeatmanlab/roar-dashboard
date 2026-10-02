/**
 * Shared context for every command, derived from this file's location and the
 * caller's working directory (an assessment directory — the npm scripts run
 * with cwd set to their package).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from './proc.mjs';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(SRC_DIR, '..', '..', '..');
export const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.assessment.yml');
export const ASSESSMENT_DIR = process.cwd();
export const ASSESSMENT_NAME = path.basename(ASSESSMENT_DIR);
export const PARAMS_FILE = path.join(ASSESSMENT_DIR, 'taskVariantParameters.json');
export const PARAMS_EXAMPLE_FILE = path.join(ASSESSMENT_DIR, 'taskVariantParameters.example.json');

export const DEFAULT_PG_PORT = '5433';

/**
 * The auth-emulator host dev bundles default to — read from the same file the
 * bundler configs use, so the CLI's probes can never drift from the bundles.
 */
export const {
  FIREBASE_EMULATOR_AUTH_HOST: ASSESSMENT_AUTH_EMULATOR_HOST,
  FIREBASE_EMULATOR_STORAGE_HOST: ASSESSMENT_STORAGE_EMULATOR_HOST,
} = createRequire(import.meta.url)(path.join(REPO_ROOT, 'apps', 'assessments', 'shared', 'devEmulatorHost.cjs'));

/**
 * Host port the ephemeral assessment Postgres publishes. Defaults to 5433 so
 * the ephemeral stack can run alongside a persistent platform-dev Postgres on
 * 5432 (docker-compose.yml, ROAR_PG_PORT).
 *
 * An explicit ASSESSMENT_PG_PORT env var wins. Without one, a running
 * assessment-db container knows its real port better than this shell does — a
 * stack started on a custom port would otherwise break `npm run seed:tasks`
 * (and the preflights) in any later shell where the variable is unset.
 *
 * @param {Function} [captureFn] - Injectable for tests; defaults to proc.capture.
 * @returns {string} The host port as a string.
 */
export function resolvePgPort(captureFn = capture) {
  const explicit = process.env.ASSESSMENT_PG_PORT;
  if (explicit) return explicit;

  const { ok, stdout } = captureFn(['docker', 'port', 'assessment-db', '5432/tcp']);
  if (ok && stdout) {
    const published = stdout.split('\n')[0].split(':').pop();
    if (published) return published;
  }
  return DEFAULT_PG_PORT;
}

/**
 * All host ports the assessment stack binds: Postgres, Firebase Auth emulator,
 * Storage emulator, Emulator UI, backend API. Looped by the port preflights in
 * `setup` (advisory) and `start` (hard gate).
 *
 * @param {string} pgPort - The resolved Postgres host port.
 * @returns {string[]}
 */
export function stackPorts(pgPort) {
  // Emulator ports come from the shared host constants so the preflight can
  // never drift from what the bundles target; the Emulator UI (9002) and
  // backend (4002) ports must match docker-compose.assessment.yml.
  return [
    pgPort,
    ASSESSMENT_AUTH_EMULATOR_HOST.split(':')[1],
    ASSESSMENT_STORAGE_EMULATOR_HOST.split(':')[1],
    '9002',
    '4002',
  ];
}

/**
 * Where the containerized assessment backend answers on the host. 4002 —
 * deliberately not 4000, which the platform dev backend owns, so both stacks
 * run in parallel. Must match the port mapping in docker-compose.assessment.yml.
 */
export const ASSESSMENT_BACKEND_URL = 'http://localhost:4002';

/**
 * Environment for docker compose invocations — the compose file substitutes
 * ${ASSESSMENT_NAME} (config mount, seed target) and ${ASSESSMENT_PG_PORT}.
 *
 * @param {string} pgPort - The resolved Postgres host port.
 * @returns {object}
 */
export function composeEnv(pgPort) {
  return { ASSESSMENT_NAME, ASSESSMENT_PG_PORT: pgPort };
}
