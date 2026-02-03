import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // Vitest normally uses mode === 'test', but we don't rely on that implicitly.
  const resolvedMode = mode || 'test';
  const root = path.dirname(fileURLToPath(import.meta.url));

  // Load env vars for this mode from process and .env files
  const env = loadEnv(resolvedMode, root, '');
  Object.assign(process.env, env);

  const isCI = process.env.CI === 'true' || process.env.CI === '1';

  const coverageConfig = {
    enabled: true,
    all: true,
    clean: true,
    provider: 'v8' as const,
    reporter: isCI
      ? ([['lcov', { projectRoot: '../..' }], 'json', 'json-summary', 'text-summary'] as const)
      : (['html', 'text'] as const),
    exclude: [
      // Vitest defaults
      'coverage/**',
      'dist/**',
      '**/node_modules/**',
      '**/[.]**',
      'cypress/**',
      '**/*.test.{js,ts,jsx,tsx}',
      '**/*.integration.test.{js,ts,jsx,tsx}',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      // Custom exclusions
      '**/test-support/**',
      'drizzle.*.config.ts',
      'vitest.*.ts',
    ],
  };

  return {
    test: {
      env,

      coverage: coverageConfig,

      projects: [
        {
          test: {
            name: 'unit',
            environment: 'node',
            globals: true,
            watch: false,
            setupFiles: ['./vitest.setup.ts'],
            exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
            env: {
              ...env,
              VITEST_PROJECT: 'unit',
            },
          },
        },
        {
          test: {
            name: 'integration',
            environment: 'node',
            globals: true,
            watch: false,
            include: ['**/*.integration.test.ts'],
            exclude: ['**/node_modules/**'],
            globalSetup: ['./vitest.integration.globalSetup.ts'],
            setupFiles: ['./vitest.setup.ts'],
            pool: 'forks',
            poolOptions: {
              forks: {
                singleFork: true,
              },
            },
            testTimeout: 30000,
            hookTimeout: 30000,
            env: {
              ...env,
              VITEST_PROJECT: 'integration',
            },
          },
        },
      ],
    },
  };
});
