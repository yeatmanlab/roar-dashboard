/**
 * Global setup for SDK integration tests.
 *
 * Seeds databases/FGA/Auth emulator via the backend seed script, then spawns
 * the backend server and waits for it to be healthy. Loads backend env vars
 * (CORE_DATABASE_URL, FGA_API_URL, etc.) via loadEnv() at the start of setup
 * so they're available in this main process without polluting unit test workers.
 *
 * When infrastructure is unavailable, the setup throws so the integration
 * test project fails immediately with a clear error message.
 *
 * Vitest expects globalSetup to return a teardown function (not a named export).
 * The teardown kills the spawned backend process and deletes the FGA store.
 *
 * Prerequisites: PostgreSQL, OpenFGA, Firebase Auth emulator, built backend.
 */

import { spawn, execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import type { ChildProcess } from 'node:child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_PORT = process.env.BACKEND_PORT || '4001';
const SEED_TIMEOUT = 120000;

/**
 * Runs the seed script to seed databases, initialize FGA, seed Auth emulator,
 * and write fixture files. Blocks until the script exits.
 *
 * @param backendDir - Absolute path to the backend workspace root
 */
function runSeedScript(backendDir: string, childEnv: Record<string, string | undefined>): void {
  const seedScript = path.join(backendDir, 'seeds', 'index.ts');
  const fixtureFile = childEnv.TEST_FIXTURE_FILE || '/tmp/roar-test-fixture.json';

  console.log('[sdk-integration] Running seed script...');

  execFileSync('npx', ['tsx', seedScript], {
    cwd: backendDir,
    env: {
      ...childEnv,
      TEST_FIXTURE_FILE: fixtureFile,
      FIREBASE_AUTH_EMULATOR_HOST: childEnv.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
      GOOGLE_CLOUD_PROJECT: childEnv.GOOGLE_CLOUD_PROJECT || 'demo-roar',
      AUTHZ_MODEL_PATH: path.resolve(backendDir, '../../packages/authz/authorization-model.fga'),
      // Point dotenv at .env.test so the seed script's `config({ override: true })`
      // reload (index.ts line 39) doesn't overwrite test DB URLs with .env values.
      DOTENV_CONFIG_PATH: path.join(backendDir, '.env.test'),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: SEED_TIMEOUT,
  });

  console.log('[sdk-integration] Seed script completed');
}

/**
 * Reads FGA store/model IDs from the backend's dotenv file (written by the seed script).
 *
 * @param backendDir - Absolute path to the backend workspace root
 * @returns Object with FGA_STORE_ID and FGA_MODEL_ID, or null if not found
 */
function readFgaEnv(backendDir: string): { FGA_STORE_ID: string; FGA_MODEL_ID: string } | null {
  // The seed script writes FGA IDs to the dotenv file resolved by DOTENV_CONFIG_PATH.
  // Since we set DOTENV_CONFIG_PATH to .env.test in the child env, read from .env.test.
  const envPath = path.join(backendDir, '.env.test');

  try {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      const storeMatch = content.match(/^FGA_STORE_ID=(.+)$/m);
      const modelMatch = content.match(/^FGA_MODEL_ID=(.+)$/m);
      if (storeMatch?.[1] && modelMatch?.[1]) {
        return { FGA_STORE_ID: storeMatch[1], FGA_MODEL_ID: modelMatch[1] };
      }
    }
  } catch {
    // File doesn't exist or is malformed
  }
  return null;
}

/**
 * Waits for the backend to be ready by polling the health endpoint.
 * Also monitors the spawned process — if it exits early (e.g., port conflict,
 * bad config), rejects immediately instead of waiting for the full timeout.
 *
 * @param proc - The spawned backend process
 * @param port - Port the backend is listening on
 * @param maxAttempts - Maximum number of poll attempts (1 second apart)
 */
async function waitForBackendHealth(proc: ChildProcess, port: string, maxAttempts = 30): Promise<void> {
  const healthUrl = `http://localhost:${port}/health/startup`;

  // Race health polling against early process exit
  const earlyExit = new Promise<never>((_, reject) => {
    proc.on('close', (code) => {
      reject(new Error(`[sdk-integration] Backend exited early with code ${code}`));
    });
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await Promise.race([fetch(healthUrl, { signal: AbortSignal.timeout(5000) }), earlyExit]);
      if (response.ok) {
        console.log(`[sdk-integration] Backend is healthy at ${healthUrl}`);
        return;
      }
    } catch (error) {
      // If the process exited, the earlyExit promise rejected — propagate it
      if (error instanceof Error && error.message.includes('exited early')) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`[sdk-integration] Backend failed to start after ${maxAttempts} attempts`);
}

/**
 * Probes a URL to check if the service is reachable.
 *
 * @param url - URL to probe (e.g., http://localhost:4010/healthz)
 * @returns true if the service responded, false otherwise
 */
async function isReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a TCP port is already in use.
 *
 * @param port - Port number to check
 * @returns true if something is listening on the port
 */
function isPortInUse(port: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port: Number(port), host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Kills a spawned process, escalating from SIGTERM to SIGKILL if needed.
 *
 * @param proc - The child process to kill
 */
async function killProcess(proc: ChildProcess): Promise<void> {
  if (proc.killed) return;

  const closed = new Promise<void>((resolve) => proc.on('close', resolve));

  proc.kill('SIGTERM');

  const graceful = await Promise.race([
    closed.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000)),
  ]);

  if (!graceful) {
    console.warn('[sdk-integration] Backend did not exit after SIGTERM, sending SIGKILL');
    proc.kill('SIGKILL');
    await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
  }

  console.log(`[sdk-integration] Backend process terminated (pid ${proc.pid})`);
}

/**
 * Deletes the FGA store created by the seed script.
 * Best-effort — failures are logged but don't propagate.
 *
 * @param fgaApiUrl - The OpenFGA server URL
 * @param storeId - The store ID to delete
 */
async function deleteFgaStore(fgaApiUrl: string, storeId: string): Promise<void> {
  try {
    const response = await fetch(`${fgaApiUrl}/stores/${storeId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      console.log(`[sdk-integration] Deleted FGA store ${storeId}`);
    }
  } catch {
    // Best effort — store may already be gone or OpenFGA may not be reachable
  }
}

export default async function globalSetup() {
  // Load backend env vars into a local object — NOT into process.env.
  // Vitest runs globalSetup for all projects in the same main process, so
  // Object.assign(process.env, env) would leak backend vars (e.g.
  // FIREBASE_AUTH_EMULATOR_HOST) into unit test workers, breaking tests
  // that assert on environment-dependent branches.
  const backendDir = path.resolve(__dirname, '../../apps/backend');
  const backendEnv = loadEnv('test', backendDir, '');

  // Merge for child processes: seed script and backend server inherit these
  // vars without polluting the current process.
  const childEnv = { ...process.env, ...backendEnv };

  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  const missing = required.filter((key) => !childEnv[key]);
  if (missing.length > 0) {
    throw new Error(
      `[sdk-integration] Missing env vars: ${missing.join(', ')}.\n` +
        'Start infrastructure with: docker compose up -d --wait',
    );
  }

  const serverBin = path.join(backendDir, 'dist', 'server.js');
  if (!existsSync(serverBin)) {
    throw new Error(
      `[sdk-integration] Backend not built (${serverBin} not found).\n` + 'Run: npm run build -w apps/backend',
    );
  }

  // Probe required services before running the slow seed script
  const fgaUrl = backendEnv.FGA_API_URL || 'http://localhost:4010';
  const emulatorHost = backendEnv.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const [fgaUp, emulatorUp] = await Promise.all([
    isReachable(`${fgaUrl}/healthz`),
    isReachable(`http://${emulatorHost}/`),
  ]);

  if (!fgaUp || !emulatorUp) {
    const down = [!fgaUp && `OpenFGA (${fgaUrl})`, !emulatorUp && `Auth emulator (${emulatorHost})`]
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `[sdk-integration] Unreachable services: ${down}.\n` + 'Start infrastructure with: docker compose up -d --wait',
    );
  }

  // Check for stale backend process before seeding
  if (await isPortInUse(BACKEND_PORT)) {
    throw new Error(
      `[sdk-integration] Port ${BACKEND_PORT} is already in use.\n` +
        'A stale backend process may be running. Kill it with: lsof -ti :' +
        BACKEND_PORT +
        ' | xargs kill',
    );
  }

  // 1. Seed databases, FGA, Auth emulator, and write fixture files
  runSeedScript(backendDir, childEnv);

  // 2. Read FGA store/model IDs written by the seed script
  const fgaEnv = readFgaEnv(backendDir);
  if (!fgaEnv) {
    console.warn('[sdk-integration] Could not read FGA env — server may fail to authorize requests');
  }

  // 3. Spawn the backend server
  console.log(`[sdk-integration] Starting server on port ${BACKEND_PORT}...`);

  const backendProcess = spawn('node', ['dist/server.js'], {
    cwd: backendDir,
    env: {
      ...childEnv,
      // Use 'production' to avoid pino-pretty transport which crashes in bundled ESM
      // (thread-stream uses __dirname, unavailable in ES modules).
      NODE_ENV: 'production',
      PORT: BACKEND_PORT,
      ALLOWED_ORIGINS: `http://localhost:${BACKEND_PORT}`,
      AUTHZ_MODEL_PATH: path.resolve(backendDir, '../../packages/authz/authorization-model.fga'),
      // Point dotenv/config at .env.test so the server connects to the test databases.
      DOTENV_CONFIG_PATH: path.join(backendDir, '.env.test'),
      ...(fgaEnv ? { FGA_STORE_ID: fgaEnv.FGA_STORE_ID, FGA_MODEL_ID: fgaEnv.FGA_MODEL_ID } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout?.on('data', (data: Buffer) => process.stdout.write(`[backend] ${data}`));
  backendProcess.stderr?.on('data', (data: Buffer) => process.stderr.write(`[backend] ${data}`));

  // 4. Wait for backend to be ready (also detects early exit)
  try {
    await waitForBackendHealth(backendProcess, BACKEND_PORT);
  } catch (error) {
    backendProcess.kill('SIGKILL');
    throw error;
  }

  // Return the teardown function — Vitest calls this after all tests complete.
  // Uses closure variables instead of globalThis so there's no stale-reference risk.
  return async function teardown() {
    await killProcess(backendProcess);

    if (fgaEnv?.FGA_STORE_ID) {
      await deleteFgaStore(fgaUrl, fgaEnv.FGA_STORE_ID);
    }
  };
}
