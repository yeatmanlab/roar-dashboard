import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  // Externalized = emitted as a bare import specifier instead of being inlined, so the
  // consumer's bundler resolves it. That is a bundler decision and is NOT the same claim as
  // `peerDependencies`; the manifest is what states who must provide a package. Conflating
  // the two is what produced the wrong proposal in project-management#2168.
  //
  // Everything the source actually imports (jspsych, i18next, etc.) is inlined. `firebase` is
  // absent from the bundle because nothing under src/ imports it — it is a harness-only
  // dependency (serve/, for anonymous Auth), not something this list externalizes.
  //
  // `assessment-schema` is deliberately *not* externalized. It is pure constants and pure
  // functions, so duplicate copies behave identically, and inlining pins each assessment to
  // the vocabulary it was built and tested against — which is the intent of per-assessment
  // bundling in project-management#2016. Build-time range agreement is guarded by the parity
  // test in project-management#2171.
  external: [/^@roar-platform\/assessment-sdk(\/.*)?$/, /^@sentry\//],
  plugins: [
    postcss({
      inject: true,
      minimize: true,
    }),
    dsv(),
    json(),
    nodeResolve({
      browser: true,
      extensions: ['.mjs', '.js', '.ts', '.json'],
    }),
    commonjs(),
    esbuild({
      platform: 'browser',
      sourceMap: true,
      minify: false,
    }),
  ],
});
