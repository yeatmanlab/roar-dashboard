/**
 * Global Setup for SDK Integration Tests
 *
 * Spawns a dedicated test server process before running integration tests.
 * The test server uses server-test.ts entrypoint which:
 * - Initializes database pools and runs migrations
 * - Truncates tables and seeds baseFixture test data
 * - Initializes OpenFGA store, deploys model, and syncs tuples
 * - Mocks AuthService to accept test tokens (token = Firebase UID)
 * - Writes fixture data to a JSON file for SDK tests to discover
 *
 * PREREQUISITES:
 * - PostgreSQL must be running on the connection string specified by CORE_DATABASE_URL
 * - OpenFGA must be running on the URL specified by FGA_API_URL (default: http://localhost:8080)
 * - Backend must be built: `npm run build -w apps/backend`
 *   (This setup automatically builds if dist/server-test.js is missing)
 *
 * TEST DATA SEEDING:
 * - baseFixture data is seeded automatically during server startup
 * - Fixture data (task variant IDs, user authIds) is written to TEST_FIXTURE_FILE
 * - SDK tests read the fixture file instead of making HTTP calls
 * - No hardcoded UUIDs needed — all test data is fetched at runtime
 *
 * ENVIRONMENT VARIABLES:
 * - BACKEND_PORT: Port for the backend server (default: 4001)
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - FGA_API_URL: OpenFGA server URL (default: http://localhost:8080)
 * - TEST_FIXTURE_FILE: Path to write fixture data JSON (default: /tmp/roar-test-fixture.json)
 *
 * TROUBLESHOOTING:
 * - "Cannot find module 'dist/server-test.js'": Run `npm run build -w apps/backend`
 * - "EADDRINUSE: port 4001 already in use": Change BACKEND_PORT or kill the existing process
 * - "Connection refused" on database: Ensure PostgreSQL is running on CORE_DATABASE_URL
 * - "Connection refused" on FGA: Ensure OpenFGA is running on FGA_API_URL
 * - Fixture file not found: Check TEST_FIXTURE_FILE path and ensure server started successfully
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = process.env.BACKEND_PORT || '4001';
const BACKEND_START_TIMEOUT = 30000; // 30 seconds
const BACKEND_BUILD_TIMEOUT = 60000; // 60 seconds for build

let backendProcess: ReturnType<typeof spawn> | null = null;

/**
 * Builds the backend if not already built.
 * Required because `npm run start` runs the compiled dist/server.js.
 */
async function buildBackendIfNeeded(backendDir: string): Promise<void> {
  const testServerBin = path.join(backendDir, 'dist', 'server-test.js');

  if (existsSync(testServerBin)) {
    console.log('[SDK Integration Tests] Test server binary already built, skipping build');
    return;
  }

  console.log('[SDK Integration Tests] Building backend...');

  return new Promise<void>((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: backendDir,
      env: {
        ...process.env,
        BUILD_TEST_SERVER: 'true', // Build both server.js and server-test.js
      },
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
 * Waits for the backend to be ready by polling the health endpoint and fixture file.
 */
async function waitForBackendHealth(port: string, fixtureFile: string, maxAttempts = 30): Promise<void> {
  const healthUrl = `http://localhost:${port}/health`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok && existsSync(fixtureFile)) {
        console.log(`[SDK Integration Tests] Backend is healthy at ${healthUrl}`);
        console.log(`[SDK Integration Tests] Fixture file exists at ${fixtureFile}`);
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

  // Build backend if needed
  try {
    await buildBackendIfNeeded(backendDir);
  } catch (error) {
    throw new Error(
      `[SDK Integration Tests] Failed to build backend: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log(`[SDK Integration Tests] Starting test server on port ${BACKEND_PORT}...`);

  // Spawn the test server process using the dedicated server-test.ts entrypoint
  // This entrypoint initializes databases, seeds fixtures, sets up FGA, and mocks auth
  backendProcess = spawn('node', ['dist/server-test.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      // Use 'production' to avoid pino-pretty transport which crashes in bundled ESM
      // (thread-stream uses __dirname, unavailable in ES modules).
      // The test server behavior is controlled by explicit setup steps, not NODE_ENV.
      NODE_ENV: 'production',
      PORT: BACKEND_PORT,
      TEST_FIXTURE_FILE: process.env.TEST_FIXTURE_FILE || '/tmp/roar-test-fixture.json',
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

  // Wait for backend to be ready
  const fixtureFile = process.env.TEST_FIXTURE_FILE || '/tmp/roar-test-fixture.json';
  try {
    await Promise.race([
      waitForBackendHealth(BACKEND_PORT, fixtureFile),
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

export async function teardown() {
  // @ts-expect-error globalThis doesn't have __BACKEND_PROCESS__ in type definitions
  const proc = globalThis.__BACKEND_PROCESS__ as ReturnType<typeof spawn> | undefined;
  if (proc) {
    proc.kill();
    await new Promise<void>((resolve) => proc.on('close', resolve));
    console.log('[SDK Integration Tests] Backend process terminated');
  }
}
