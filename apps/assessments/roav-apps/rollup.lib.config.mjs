import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';
import OMT from '@surma/rollup-plugin-off-main-thread';
import { wasm } from '@rollup/plugin-wasm';
import url from '@rollup/plugin-url';
import copy from 'rollup-plugin-copy';

// Resolve onnxruntime-web's dist dir via the module system so the runtime WASM
// binaries copy correctly whether the dep is hoisted (monorepo root node_modules)
// or installed package-locally.
const require = createRequire(import.meta.url);
// onnxruntime-web ships its entry (and the runtime .wasm binaries) in dist/.
const onnxRuntimeDist = dirname(require.resolve('onnxruntime-web'));

// The roav-cr task pulls in the eyetracking pipeline (src/tasks/et/*), which runs ONNX
// inference in a Web Worker (et_worker.js) and loads WASM + the eyetracking_google.onnx
// model at runtime. So — like Read Aloud, the reference ONNX assessment — the build emits a
// `dist/` directory (worker chunks + .wasm + the model) rather than a single
// `dist/index.js`, and keeps the off-main-thread / wasm / binary-copy plugins. roav-mp and
// roav-rvp remain plain perception tasks with no eyetracking; their timelines never reach
// the worker.
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
    OMT(),
    wasm(),
    url({
      include: '**/*.wasm',
      limit: 0, // always emit files, never inline
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
    copy({
      targets: [
        { src: `${onnxRuntimeDist}/*.wasm`, dest: 'dist' },
        // et_worker.js loads the model from the absolute path `/et/eyetracking_google.onnx`.
        { src: 'src/tasks/et/eyetracking_google.onnx', dest: 'dist/et' },
      ],
    }),
  ],
});
