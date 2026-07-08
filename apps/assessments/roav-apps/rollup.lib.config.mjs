import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';

// Library build consumed by the dashboard: bundles the TaskLauncher entry to a single
// `dist/index.js`. Unlike Read Aloud, roav-apps has no eyetracking/ONNX/WASM/worker, so
// this is the standard single-file lib config — no off-main-thread, wasm, or asset-copy
// plugins. Task corpora and media are fetched at runtime from the roav-mp GCS bucket
// (see src/tasks/taskConfig.js bucketURI), not bundled here.
export default defineConfig({
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: 'index.js',
    chunkFileNames: '[name].js',
    assetFileNames: '[name][extname]',
    sourcemap: true,
  },
  // Workspace deps, auth, and Sentry are externalized — the consuming host (dashboard)
  // provides them, keeping duplicate copies out of the lib bundle.
  external: [/^@roar-platform\/assessment-sdk(\/.*)?$/, /^@roar-platform\/assessment-schema(\/.*)?$/, /^@sentry\//],
  plugins: [
    postcss({
      inject: true,
      minimize: true,
    }),
    dsv(),
    json(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.mjs', '.js', '.json'],
    }),
    // No `include` filter: in the monorepo, deps are hoisted to the root node_modules, so a
    // package-relative `node_modules/**` would miss them and CommonJS packages (store2,
    // lodash, …) wouldn't be interop-transformed.
    commonjs({
      transformMixedEsModules: true,
    }),
    esbuild({
      platform: 'browser',
      sourceMap: true,
      minify: false, // consumers run their own bundler (webpack, Vite) which minifies
    }),
  ],
});
