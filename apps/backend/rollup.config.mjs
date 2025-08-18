import { defineConfig } from 'rollup';
import externals from 'rollup-plugin-node-externals';
import esbuild from 'rollup-plugin-esbuild';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import run from '@rollup/plugin-run';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  input: 'src/server.ts',
  output: isDev
    ? {
        dir: 'dist',
        format: 'esm',
        sourcemap: 'inline',
        preserveModules: true,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        exports: 'auto'
      }
    : {
        file: `dist/server.js`,
        format: 'esm',
        sourcemap: true,
        exports: 'auto'
      },
  plugins: [
    externals({ deps: true, devDeps: false, peerDeps: true }),

    alias({
      entries: [
        { find: '@', replacement: new URL('./src', import.meta.url).pathname }
      ]
    }),

    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
      extensions: ['.mjs', '.js', '.ts', '.json']
    }),

    commonjs(),

    json(),

    esbuild({
      platform: 'node',
      tsconfig: 'tsconfig.json',
      sourceMap: true,
      minify: false
    }),

    isDev && run({
      execArgv: ['--enable-source-maps']
    })
  ].filter(Boolean),

  treeshake: isDev ? false : 'recommended',

  watch: {
    clearScreen: false,
    buildDelay: 50
  }
});