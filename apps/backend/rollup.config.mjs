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
      },
  plugins: [
    // Externalize Node deps to keep bundle fast and small. In dev we purposely do not externalize the local workspace
    // package so that Rollup watches its source and triggers rebuilds automatically.
    externals({ exclude: isDev ? ['@repo/api-contract'] : [] }),

    alias({
      entries: [
        // Convenience alias used across the backend source code
        { find: '@', replacement: new URL('./src', import.meta.url).pathname },

        // In dev, point the local monorepo package to its src/ instead of dist/. This makes Rollup compile it with
        // esbuild, watch for changes, and restart the server when internal package source files change. In production
        // we externalize the package so that it is not included in the bundle and is instead loaded from node_modules.
        // This approach is, somewhat unfortunately, more efficient than using turbo's watch mode.
        ...(isDev
          ? [
              {
                find: '@repo/api-contract',
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
