import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import dsv from '@rollup/plugin-dsv';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { sentryRollupPlugin } from '@sentry/rollup-plugin';
import 'dotenv/config';

export default {
  input: 'src/index.js',
  plugins: [
    postcss({
      extract: 'resources/roar-swr.css',
    }),
    dsv(),
    json(),
    nodeResolve({
      preferBuiltins: true,
    }),
    terser(),
    commonjs(),
    sentryRollupPlugin({
      org: 'roar-89588e380',
      project: 'swr',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  output: [
    {
      dir: 'lib',
      name: '@bdelab/roar-swr',
      entryFileNames: '[name].[hash].js',
      chunkFileNames: '[name].[hash].js',
      format: 'es',
      sourcemap: true,
    },
  ],
};
