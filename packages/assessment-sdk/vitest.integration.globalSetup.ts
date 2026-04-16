/**
 * Global Setup for SDK Integration Tests
 *
 * Spawns a backend server process before running integration tests.
 * The backend connects to test databases and seeds test data.
 *
 * Environment variables:
 * - BACKEND_PORT: Port for the backend server (default: 4001)
 * - CORE_DATABASE_URL: Core database connection string (required)
 * - ASSESSMENT_DATABASE_URL: Assessment database connection string (required)
 * - SEED_TEST_DATA: Set to 'true' to seed test data (default: true)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = process.env.BACKEND_PORT || '4001';
const BACKEND_START_TIMEOUT = 30000; // 30 seconds

let backendProcess: ReturnType<typeof spawn> | null = null;

/**
 * Waits for the backend to be ready by polling the health endpoint.
 */
async function waitForBackendHealth(port: string, maxAttempts = 30): Promise<void> {
  const healthUrl = `http://localhost:${port}/health`;
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

export default async function globalSetup() {
  // Validate required environment variables
  const required = ['CORE_DATABASE_URL', 'ASSESSMENT_DATABASE_URL'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[SDK Integration Tests] Missing required env var: ${key}`);
    }
  }

  console.log(`[SDK Integration Tests] Starting backend on port ${BACKEND_PORT}...`);

  // Spawn the backend process
  const backendDir = path.resolve(__dirname, '../../apps/backend');
  backendProcess = spawn('npm', ['run', 'start'], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: BACKEND_PORT,
      SEED_TEST_DATA: process.env.SEED_TEST_DATA ?? 'true',
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
  try {
    await Promise.race([
      waitForBackendHealth(BACKEND_PORT),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[SDK Integration Tests] Backend startup timeout after ${BACKEND_START_TIMEOUT}ms`)),
          BACKEND_START_TIMEOUT,
        ),
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
