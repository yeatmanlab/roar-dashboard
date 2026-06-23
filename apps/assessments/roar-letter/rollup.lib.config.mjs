import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';

const sentryPlugin = process.env.SENTRY_AUTH_TOKEN
  ? [
      (await import('@sentry/rollup-plugin')).sentryRollupPlugin({
        org: 'roar-89588e380',
        project: 'letter',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        deleteSourcemapsAfterUpload: true,
      }),
    ]
  : [];

export default defineConfig({
  input: 'src/experiment/index.js',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  // @sentry/* is provided by the dashboard's own Sentry setup — externalize to avoid
  // double-registering Sentry when the bundle is consumed.
  // All other deps (jspsych, firebase, @bdelab/*) are bundled for a self-contained package.
  external: [/^@sentry\//],
  plugins: [
    postcss({
      inject: true,
      minimize: true,
    }),
    dsv(),
    json(),
    nodeResolve({
      browser: true,
      extensions: ['.mjs', '.js', '.json'],
    }),
    commonjs(),
    esbuild({
      platform: 'browser',
      sourceMap: true,
      minify: false,
    }),
    ...sentryPlugin,
  ],
});
