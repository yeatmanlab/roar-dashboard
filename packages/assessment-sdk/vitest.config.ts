import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// @ts-expect-error - vitest/vite mode parameter type mismatch
export default defineConfig(({ mode }) => {
  const resolvedMode = mode || 'test';
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/backend');

  // Load env vars from the backend's .env.test/.env — the SDK integration
  // tests need CORE_DATABASE_URL, ASSESSMENT_DATABASE_URL, FGA_API_URL, etc.
  // to run seeds/index.ts and spawn the backend server.
  // Object.assign makes them available in globalSetup (which runs in the main
  // process before workers), matching the backend's vitest.config.ts pattern.
  const env = loadEnv(resolvedMode, backendDir, '');
  Object.assign(process.env, env);

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
