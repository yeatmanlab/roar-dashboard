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
  input: 'src/server.ts',
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
        file: `dist/server.js`,
        format: 'esm',
        sourcemap: true,
        exports: 'auto',
        inlineDynamicImports: true,
      },
  plugins: [
    // In dev, externalize node_modules (except our workspace package) to keep rebuilds fast.
    // In production, skip externals entirely so rollup bundles everything into a single server.js — no node_modules
    // needed at runtime.
    isDev && externals({ exclude: ['@roar-dashboard/api-contract'] }),

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
