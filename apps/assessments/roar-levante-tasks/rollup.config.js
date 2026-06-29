import commonjs from '@rollup/plugin-commonjs';
import dsv from '@rollup/plugin-dsv';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';
import { sentryRollupPlugin } from '@sentry/rollup-plugin';
// @TODO import dotenv.config
export default {
  input: 'src/index.ts',
  plugins: [
    typescript({ module: 'ESNext' }),
    postcss({
      extract: 'resources/core-tasks.css',
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
      project: 'roar-levante-tasks',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  output: [
    {
      dir: 'lib',
      name: '@bdelab/roar-levante-tasks',
      entryFileNames: '[name].[hash].js',
      chunkFileNames: '[name].[hash].js',
      format: 'es',
      sourcemap: true,
    },
  ],
};
