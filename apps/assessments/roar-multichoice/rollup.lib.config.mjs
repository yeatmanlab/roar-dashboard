import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';
import { escalateUnresolvedImports } from '../shared/rollupLogging.js';
import { browserBuiltins } from '../shared/rollupResolve.js';

export default defineConfig({
  input: 'src/experiment/index.js',
  output: {
    file: 'dist/index.js',
    format: 'es',
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
    postcss({ inject: true, minimize: true }),
    dsv(),
    json(),
    browserBuiltins,
    nodeResolve({ browser: true, extensions: ['.mjs', '.js', '.json'] }),
    commonjs(),
    esbuild({ platform: 'browser', sourceMap: true, minify: false }),
  ],

  // A resolution failure would otherwise be a warning that still produces a package.
  onLog: escalateUnresolvedImports,
});
