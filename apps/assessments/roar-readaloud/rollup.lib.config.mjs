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
import html from '@rollup/plugin-html';
import { string } from 'rollup-plugin-string';
import copy from 'rollup-plugin-copy';

// Resolve onnxruntime-web's dist dir via the module system so the runtime WASM
// binaries copy correctly whether the dep is hoisted (monorepo root node_modules)
// or installed package-locally.
const require = createRequire(import.meta.url);
// onnxruntime-web ships its entry (and the runtime .wasm binaries) in dist/.
const onnxRuntimeDist = dirname(require.resolve('onnxruntime-web'));

// Read Aloud diverges from the standard single-file lib template: the gaze-estimation
// pipeline runs ONNX inference in a Web Worker and loads WASM + an .onnx model at runtime.
// So the build emits a `dist/` directory (worker chunks + .wasm + the model) rather than a
// single `dist/index.js`, and keeps the off-main-thread / wasm / binary-copy plugins.
export default defineConfig({
  input: 'src/experiment/index.js',
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: 'index.js',
    chunkFileNames: '[name].js',
    assetFileNames: '[name][extname]',
    sourcemap: true,
  },
  // Workspace deps and peer deps are externalized — consumers provide these themselves.
  external: [/^@roar-platform\/assessment-sdk(\/.*)?$/, /^@sentry\//],
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
    // No `include` filter: in the monorepo, deps are hoisted to the root
    // node_modules, so a package-relative `node_modules/**` would miss them and
    // CommonJS packages (store2, lodash, …) wouldn't be interop-transformed.
    commonjs({
      transformMixedEsModules: true,
    }),
    esbuild({
      platform: 'browser',
      sourceMap: true,
      minify: false, // consumers run their own bundler (webpack, Vite) which minifies
    }),
    html(),
    string({
      include: '**/*.html',
    }),
    copy({
      targets: [
        { src: `${onnxRuntimeDist}/*.wasm`, dest: 'dist' },
        { src: 'src/experiment/views/eyetracking_google.onnx', dest: 'dist/views' },
      ],
    }),
  ],
});
