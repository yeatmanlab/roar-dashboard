import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';

export default defineConfig({
  input: 'src/experiment/index.js',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  // `assessment-schema` is deliberately bundled rather than externalized: it is pure constants
  // and pure functions, so duplicate copies behave identically, and inlining pins each
  // assessment to the vocabulary it was built and tested against. `firebase` is absent from
  // the bundle because nothing under src/ imports it, not because this list externalizes it.
  external: [/^@roar-platform\/assessment-sdk(\/.*)?$/, /^@sentry\//],
  plugins: [
    postcss({ inject: true, minimize: true }),
    dsv(),
    json(),
    nodeResolve({ browser: true, extensions: ['.mjs', '.js', '.json'] }),
    commonjs(),
    esbuild({ platform: 'browser', sourceMap: true, minify: false }),
  ],
});
