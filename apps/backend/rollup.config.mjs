import { defineConfig } from 'rollup';
import externals from 'rollup-plugin-node-externals';
import esbuild from 'rollup-plugin-esbuild';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import run from '@rollup/plugin-run';

const isDev = process.env.NODE_ENV !== 'production';
const buildTestServer = process.env.BUILD_TEST_SERVER === 'true';

// Only include server-test.ts if explicitly requested via BUILD_TEST_SERVER=true
// This prevents the test server from being shipped with the production build
const input = buildTestServer ? ['src/server.ts', 'src/server-test.ts'] : 'src/server.ts';

export default defineConfig({
  input,
  output: isDev
    ? {
        dir: 'dist',
        format: 'esm',
        sourcemap: 'inline',
        exports: 'auto',
      }
    : {
        // Output to a directory with code splitting enabled.
        // IMPORTANT: Do NOT use `file` + `inlineDynamicImports: true` here.
        //
        // server.ts and server-test.ts use dynamic imports to defer loading the application module
        // until after initializeDatabasePools() completes. This ensures CoreDbClient and
        // AssessmentDbClient are defined before any module-level service/repository
        // instantiation occurs (e.g., `const userService = UserService()` in auth middleware).
        //
        // inlineDynamicImports collapses this boundary into a single file, causing all
        // module-level code to execute at load time — before the DB clients are initialized.
        // Code splitting preserves the dynamic imports as separate chunks, maintaining the
        // correct initialization order.
        dir: 'dist',
        inlineDynamicImports: false,
        format: 'esm',
        sourcemap: true,
        exports: 'auto',
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
      },
  plugins: [
    // Alias runs before externals so that workspace-package imports are rewritten to TS source
    // paths before the externals plugin ever sees them. Without this ordering, externals would
    // mark e.g. `@roar-dashboard/assessment-schema/pa` as external (it's a valid node_module
    // symlink), and the alias would never get a chance to redirect it to the TS source.
    alias({
      entries: [
        // Convenience alias used across the backend source code
        { find: '@', replacement: new URL('./src', import.meta.url).pathname },

        // In dev, point @roar-dashboard/api-contract to its TS source so Rollup compiles it
        // with esbuild and watches for changes. In production it resolves to its built dist/
        // via normal node resolution (single `.` export, nodeResolve handles it fine).
        ...(isDev
          ? [
              {
                find: '@roar-dashboard/api-contract',
                replacement: new URL('../../packages/api-contract/src/index.ts', import.meta.url).pathname,
              },
            ]
          : []),

        // @roar-dashboard/assessment-schema is always aliased because nodeResolve does
        // not reliably follow subpath exports through workspace symlinks. A regex find
        // handles the bare specifier and all subpath imports (e.g. /pa, /swr) in a
        // single entry — new assessment subpaths work automatically without changes here.
        //
        // How the replacement works: the capture group `(\/[^/]+)?` is either the
        // subpath (e.g. "/pa") or empty string, and `$1` splices it into the output
        // path via standard JS regex replacement — giving e.g. `.../src/pa/index.ts`.
        {
          find: /^@roar-dashboard\/assessment-schema(\/[^/]+)?$/,
          replacement:
            new URL(
              isDev ? '../../packages/assessment-schema/src' : '../../packages/assessment-schema/dist',
              import.meta.url,
            ).pathname + `$1/index.${isDev ? 'ts' : 'js'}`,
        },
      ],
    }),

    // In dev, externalize node_modules to keep rebuilds fast.
    // In production, skip externals entirely so rollup bundles everything into a single server.js — no node_modules
    // needed at runtime.
    isDev &&
      externals({
        exclude: [
          // Workspace packages — rewritten to TS source by the alias plugin above, then
          // compiled by esbuild. Must be excluded from externalization so Rollup doesn't
          // short-circuit them before the alias runs (alias is first, but externals would
          // still match the resolved file path if we didn't exclude these).
          '@roar-dashboard/api-contract',
          '@roar-dashboard/assessment-schema',
          // CJS packages — Node's ESM runtime can't load these as named-export
          // imports, so we bundle them through the commonjs() plugin instead.
          '@openfga/sdk',
          'crc-32',
        ],
      }),

    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      extensions: ['.mjs', '.js', '.ts', '.json'],
    }),

    commonjs(),

    json(),

    esbuild({
      platform: 'node',
      tsconfig: 'tsconfig.json',
      sourceMap: true,
      minify: false,
    }),

    isDev &&
      run({
        execArgv: ['--enable-source-maps', '--use-system-ca'],
      }),
  ].filter(Boolean),

  // Treat unresolved imports as build errors. Without this, rollup silently leaves the bare
  // import in the output, which crashes at runtime in the distroless Docker container where
  // no node_modules directory exists.
  onLog(level, log, handler) {
    if (log.code === 'UNRESOLVED_IMPORT') {
      handler('error', log);
      return;
    }
    handler(level, log);
  },

  treeshake: isDev ? false : 'recommended',

  watch: {
    clearScreen: false,
    buildDelay: 50,
  },
});
