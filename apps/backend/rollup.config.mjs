import { defineConfig } from 'rollup';
import externals from 'rollup-plugin-node-externals';
import esbuild from 'rollup-plugin-esbuild';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import run from '@rollup/plugin-run';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  input: ['src/server.ts', 'src/server-test.ts'],
  output: isDev
    ? {
        dir: 'dist',
        format: 'esm',
        sourcemap: 'inline',
        preserveModules: true,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
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
    // In dev, externalize node_modules to keep rebuilds fast.
    // In production, skip externals entirely so rollup bundles everything into a single server.js — no node_modules
    // needed at runtime.
    isDev &&
      externals({
        exclude: [
          // Workspace package — must be compiled from TS source via the alias below
          '@roar-dashboard/api-contract',
          // CJS package without an `exports` field — Node's ESM resolver can't
          // resolve the bare specifier at runtime, so we bundle it through the
          // commonjs() plugin instead
          '@openfga/sdk',
        ],
      }),

    alias({
      entries: [
        // Convenience alias used across the backend source code
        { find: '@', replacement: new URL('./src', import.meta.url).pathname },

        // In dev, point the local monorepo package to its src/ instead of dist/. This makes Rollup compile it with
        // esbuild, watch for changes, and restart the server when internal package source files change. In production
        // the package resolves to its built dist/ via normal node resolution, but is still bundled (not externalized).
        ...(isDev
          ? [
              {
                find: '@roar-dashboard/api-contract',
                replacement: new URL('../../packages/api-contract/src/index.ts', import.meta.url).pathname,
              },
            ]
          : []),
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
        execArgv: ['--enable-source-maps'],
      }),
  ].filter(Boolean),

  treeshake: isDev ? false : 'recommended',

  watch: {
    clearScreen: false,
    buildDelay: 50,
  },
});
