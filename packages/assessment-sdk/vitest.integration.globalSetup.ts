/**
 * Global Setup for SDK Integration Tests
 *
 * Runs the standalone seed script (seed-dev.ts) and then spawns the backend
 * server (server.ts with Firebase Auth emulator) before running integration tests.
 *
 * The seed script:
 * - Initializes database pools and runs migrations
 * - Truncates tables and seeds deterministic dev fixture data
 * - Initializes OpenFGA store, deploys model, and syncs tuples
 * - Seeds Firebase Auth emulator users (with deterministic credentials)
 * - Writes fixture data to a JSON file for SDK tests to discover
 * - Writes FGA store/model IDs to the backend's .env file
 *
 * The server uses FIREBASE_AUTH_EMULATOR_HOST so Firebase Admin SDK verifies
 * tokens against the local emulator. SDK tests sign in via the emulator REST
 * API to get real Firebase ID tokens.
 *
 * PREREQUISITES:
 * - PostgreSQL must be running on the connection string specified by CORE_DATABASE_URL
 * - OpenFGA must be running on the URL specified by FGA_API_URL (default: http://localhost:8080)
 * - Firebase Auth emulator must be running on FIREBASE_AUTH_EMULATOR_HOST (default: 127.0.0.1:9099)
 * - Backend must be built: `npm run build -w apps/backend`
 *   (This setup automatically builds if dist/server.js is missing)
 *
 * TEST DATA SEEDING:
 * - Dev fixture data is seeded by seed-dev.ts before the server starts
 * - Fixture data (task variant IDs, user credentials) is written to TEST_FIXTURE_FILE
 * - SDK tests read the fixture file and sign in via the emulator
 *
 * ENVIRONMENT VARIABLES:
 * - BACKEND_PORT: Port for the backend server (default: 4001)
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:8080)
 * - FIREBASE_AUTH_EMULATOR_HOST: Auth emulator host (default: 127.0.0.1:9099)
 * - GOOGLE_CLOUD_PROJECT: GCP project for emulator (default: demo-roar)
 * - TEST_FIXTURE_FILE: Path to write fixture data JSON (default: /tmp/roar-test-fixture.json)
 *
 * TROUBLESHOOTING:
 * - "Cannot find module 'dist/server.js'": Run `npm run build -w apps/backend`
 * - "EADDRINUSE: port 4001 already in use": Change BACKEND_PORT or kill the existing process
 * - "Connection refused" on database: Ensure PostgreSQL is running on CORE_DATABASE_URL
 * - "Connection refused" on FGA: Ensure OpenFGA is running on FGA_API_URL
 * - "Auth emulator sign-in failed": Ensure Auth emulator is running on FIREBASE_AUTH_EMULATOR_HOST
 * - Fixture file not found: Check TEST_FIXTURE_FILE path and ensure seed completed successfully
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = process.env.BACKEND_PORT || '4001';
const BACKEND_START_TIMEOUT = 30000; // 30 seconds
const BACKEND_BUILD_TIMEOUT = 60000; // 60 seconds for build
const SEED_TIMEOUT = 120000; // 120 seconds for seeding

let backendProcess: ReturnType<typeof spawn> | null = null;

/**
 * Builds the backend if dist/server.js is missing or stale.
 *
 * @param backendDir - Absolute path to the backend workspace root
 */
async function buildBackendIfNeeded(backendDir: string): Promise<void> {
  const serverBin = path.join(backendDir, 'dist', 'server.js');
  const sourceFile = path.join(backendDir, 'src', 'server.ts');

  if (existsSync(serverBin) && existsSync(sourceFile)) {
    const binStats = statSync(serverBin);
    const srcStats = statSync(sourceFile);
    if (binStats.mtime > srcStats.mtime) {
      console.log('[SDK Integration Tests] Server binary is up-to-date');
      return;
    }
  }

  console.log('[SDK Integration Tests] Building backend...');

  return new Promise<void>((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: backendDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let buildOutput = '';
    let buildError = '';

    buildProcess.stdout?.on('data', (data) => {
      buildOutput += data.toString();
    });

    buildProcess.stderr?.on('data', (data) => {
      buildError += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('[SDK Integration Tests] Backend build completed successfully');
        resolve();
      } else {
        reject(
          new Error(
            `[SDK Integration Tests] Backend build failed with code ${code}.\nStdout: ${buildOutput}\nStderr: ${buildError}`,
          ),
        );
      }
    });

    buildProcess.on('error', (error) => {
      reject(new Error(`[SDK Integration Tests] Failed to spawn build process: ${error.message}`));
    });

    setTimeout(() => {
      buildProcess.kill();
      reject(new Error(`[SDK Integration Tests] Backend build timeout after ${BACKEND_BUILD_TIMEOUT}ms`));
    }, BACKEND_BUILD_TIMEOUT);
  });
}

/**
 * Runs the seed-dev.ts script to seed databases, initialize FGA, seed Auth emulator,
 * and write fixture files. Blocks until the script exits.
 *
 * @param backendDir - Absolute path to the backend workspace root
 */
function runSeedScript(backendDir: string): void {
  const seedScript = path.join(backendDir, 'scripts', 'seed-dev.ts');
  const fixtureFile = process.env.TEST_FIXTURE_FILE || '/tmp/roar-test-fixture.json';

  console.log('[SDK Integration Tests] Running seed script...');

  execFileSync('npx', ['tsx', seedScript], {
    cwd: backendDir,
    env: {
      ...process.env,
      TEST_FIXTURE_FILE: fixtureFile,
      // Ensure the seed script seeds Auth emulator users
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'demo-roar',
      // Provide absolute path so the seed script can find the FGA model
      AUTHZ_MODEL_PATH: path.resolve(backendDir, '../../packages/authz/authorization-model.fga'),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: SEED_TIMEOUT,
  });

  console.log('[SDK Integration Tests] Seed script completed');
}

/**
 * Reads FGA store/model IDs from the backend's dotenv file (written by seed-dev.ts).
 *
 * @param backendDir - Absolute path to the backend workspace root
 * @returns Object with FGA_STORE_ID and FGA_MODEL_ID, or null if not found
 */
function readFgaEnv(backendDir: string): { FGA_STORE_ID: string; FGA_MODEL_ID: string } | null {
  // Use DOTENV_CONFIG_PATH if set (CI), otherwise default to .env (local dev)
  const envPath = process.env.DOTENV_CONFIG_PATH
    ? path.resolve(process.env.DOTENV_CONFIG_PATH)
    : path.join(backendDir, '.env');

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
 *
 * @param port - Port the backend is listening on
 * @param maxAttempts - Maximum number of poll attempts (1 second apart)
 */
async function waitForBackendHealth(port: string, maxAttempts = 30): Promise<void> {
  const healthUrl = `http://localhost:${port}/health/startup`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[SDK Integration Tests] Backend is healthy at ${healthUrl}`);
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `[SDK Integration Tests] Backend failed to start after ${maxAttempts} attempts. Last error: ${lastError?.message}`,
  );
}

/**
 * Global setup for SDK integration tests.
 *
 * 1. Builds the backend if dist/server.js is missing or stale
 * 2. Runs seed-dev.ts to seed databases, initialize FGA, seed Auth emulator, and write fixture files
 * 3. Reads FGA store/model IDs written by the seed script
 * 4. Spawns the backend server with FIREBASE_AUTH_EMULATOR_HOST and FGA env vars
 * 5. Waits for the server to be healthy
 *
 * Requires CORE_DATABASE_URL, ASSESSMENT_DATABASE_URL, and a running Auth emulator.
 *
 * @returns Promise that resolves when the test server is ready
 */
export default async function globalSetup() {
  // Skip backend startup when integration tests are not requested
  if (process.env.RUN_INTEGRATION_TESTS !== 'true') {
    console.log('[SDK Integration Tests] Skipping global setup (RUN_INTEGRATION_TESTS not set)');
    return;
  }

  // Validate required environment variables
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[SDK Integration Tests] Missing required env var: ${key}`);
    }
  }

  const backendDir = path.resolve(__dirname, '../../apps/backend');

  // 1. Build backend if needed
  try {
    await buildBackendIfNeeded(backendDir);
  } catch (error) {
    throw new Error(
      `[SDK Integration Tests] Failed to build backend: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 2. Run seed script (migrations, truncate, seed fixture, FGA setup, fixture files)
  try {
    runSeedScript(backendDir);
  } catch (error) {
    throw new Error(
      `[SDK Integration Tests] Seed script failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 3. Read FGA env written by seed script to the backend .env file
  const fgaEnv = readFgaEnv(backendDir);
  if (!fgaEnv) {
    console.warn(
      '[SDK Integration Tests] Could not read FGA env from backend .env file — server may fail to authorize requests',
    );
  }

  // 4. Spawn the backend server with Firebase Auth emulator
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || 'demo-roar';
  console.log(`[SDK Integration Tests] Starting server on port ${BACKEND_PORT} (Auth emulator: ${emulatorHost})...`);

  backendProcess = spawn('node', ['dist/server.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      // Use 'production' to avoid pino-pretty transport which crashes in bundled ESM
      // (thread-stream uses __dirname, unavailable in ES modules).
      // Trade-off: logs are JSON only, less readable during debugging.
      // For human-readable logs, rebuild locally: NODE_ENV=development npm run test -w packages/assessment-sdk
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: `http://localhost:${BACKEND_PORT}`,
      PORT: BACKEND_PORT,
      // Firebase Admin SDK connects to the emulator when this is set —
      // no TestAuthProvider needed, real Firebase ID tokens are verified.
      FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
      GOOGLE_CLOUD_PROJECT: gcpProject,
      // Provide absolute path so bundled code doesn't rely on __dirname-relative resolution
      AUTHZ_MODEL_PATH: path.resolve(backendDir, '../../packages/authz/authorization-model.fga'),
      // Pass through FGA env vars so the server can authorize requests
      ...(fgaEnv ? { FGA_STORE_ID: fgaEnv.FGA_STORE_ID, FGA_MODEL_ID: fgaEnv.FGA_MODEL_ID } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Capture backend output for debugging
  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Backend stdout] ${data}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error(`[Backend stderr] ${data}`);
  });

  // Handle backend process errors
  backendProcess.on('error', (error) => {
    console.error('[SDK Integration Tests] Failed to spawn backend:', error);
  });

  backendProcess.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[SDK Integration Tests] Backend exited with code ${code}`);
    }
    if (signal) {
      console.error(`[SDK Integration Tests] Backend killed by signal ${signal}`);
    }
  });

  // 5. Wait for backend to be ready
  try {
    await Promise.race([
      waitForBackendHealth(BACKEND_PORT),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          const dbUrl = process.env.CORE_DATABASE_URL ? '(set)' : '(not set)';
          const fgaUrl = process.env.FGA_API_URL || 'http://localhost:8080';
          reject(
            new Error(
              `[SDK Integration Tests] Backend startup timeout after ${BACKEND_START_TIMEOUT}ms. ` +
                `Check that PostgreSQL (${dbUrl}) and OpenFGA (${fgaUrl}) are running.`,
            ),
          );
        }, BACKEND_START_TIMEOUT),
      ),
    ]);
  } catch (error) {
    if (backendProcess) {
      backendProcess.kill();
    }
    throw error;
  }

  // Store the backend process for cleanup
  // @ts-expect-error globalThis doesn't have __BACKEND_PROCESS__ in type definitions
  globalThis.__BACKEND_PROCESS__ = backendProcess;
  // @ts-expect-error globalThis doesn't have __BACKEND_PORT__ in type definitions
  globalThis.__BACKEND_PORT__ = BACKEND_PORT;
}

/**
 * Global teardown for SDK integration tests.
 *
 * Kills the server process spawned by globalSetup.
 * Waits for the process to fully close before returning.
 *
 * @returns Promise that resolves when the backend process has been terminated
 */
export async function teardown() {
  // @ts-expect-error globalThis doesn't have __BACKEND_PROCESS__ in type definitions
  const proc = globalThis.__BACKEND_PROCESS__ as ReturnType<typeof spawn> | undefined;
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    const close = new Promise<void>((resolve) => proc.on('close', resolve));
    await Promise.race([timeout, close]);
    console.log('[SDK Integration Tests] Backend process terminated');
  }
}
