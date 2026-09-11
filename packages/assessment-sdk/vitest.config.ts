import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const resolvedMode = mode || 'test';
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/backend');

  // Load env vars from the backend's .env.test/.env — the SDK integration
  // tests need CORE_DATABASE_URL, ASSESSMENT_DATABASE_URL, FGA_API_URL, etc.
  // The `env` object is passed to the integration project so its workers
  // receive the vars. The globalSetup file loads its own copy of these vars
  // via loadEnv() — see vitest.integration.globalSetup.ts.
  //
  // NOTE: Do NOT Object.assign these into process.env here. That would leak
  // backend env vars (e.g. FIREBASE_AUTH_EMULATOR_HOST) into unit test
  // workers, breaking tests that assert on environment-dependent branches.
  const env = loadEnv(resolvedMode, backendDir, '');

  return {
    test: {
      projects: [
        {
          test: {
            name: 'unit',
            environment: 'node',
            globals: true,
            include: ['src/**/*.test.ts'],
            exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
            setupFiles: ['./vitest.setup.ts'],
            testTimeout: 30000,
            hookTimeout: 30000,
          },
        },
        {
          test: {
            name: 'integration',
            environment: 'node',
            globals: true,
            include: ['src/**/*.integration.test.ts'],
            exclude: ['**/node_modules/**'],
            globalSetup: ['./vitest.integration.globalSetup.ts'],
            setupFiles: ['./vitest.setup.ts'],
            testTimeout: 30000,
            hookTimeout: 30000,
            env,
          },
        },
      ],
    },
  };
});
