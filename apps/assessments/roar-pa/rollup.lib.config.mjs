import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dsv from '@rollup/plugin-dsv';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';

export default defineConfig({
  input: 'src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  // Workspace deps and peer deps are externalized — consumers provide these themselves.
  // Everything else (jspsych, firebase, i18next, etc.) is bundled for a self-contained package.
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
      extensions: ['.mjs', '.js', '.json'],
    }),
    commonjs(),
    esbuild({
      platform: 'browser',
      sourceMap: true,
      minify: false, // Consumers run their own bundler (webpack, Vite) which handles minification.
    }),
  ],
});
