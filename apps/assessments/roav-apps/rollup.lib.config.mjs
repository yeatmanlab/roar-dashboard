import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';
import { escalateUnresolvedImports } from '../shared/rollupLogging.js';
import { browserBuiltins } from '../shared/rollupResolve.js';

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
  // `assessment-sdk` is bundled, not externalized: a copy shared with the host is also a shared
  // `FirekitFacade` singleton, and pins this assessment to whatever SDK version the host resolved.
  //
  // `assessment-schema` is deliberately bundled rather than externalized: it is pure constants
  // and pure functions, so duplicate copies behave identically, and inlining pins each
  // assessment to the vocabulary it was built and tested against. `firebase` is absent from
  // the bundle because neither src/ nor the bundled SDK imports it, not because this list
  // externalizes it.
  external: [/^@sentry\//],
  plugins: [
    postcss({
      inject: true,
      minimize: true,
    }),
    dsv(),
    json(),
    browserBuiltins,
    nodeResolve({
      browser: true,
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

  // A resolution failure would otherwise be a warning that still produces a package.
  onLog: escalateUnresolvedImports,
});
