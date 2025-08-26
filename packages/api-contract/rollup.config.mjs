import { defineConfig } from 'rollup';
import externals from 'rollup-plugin-node-externals';
import esbuild from 'rollup-plugin-esbuild';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: isDev ? 'inline' : true,
    preserveModules: true,
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name].mjs',
    exports: 'auto',
  },
  plugins: [
    externals({ deps: true, devDeps: false, peerDeps: true }),
    esbuild({
      platform: 'node',
      tsconfig: 'tsconfig.json',
      sourceMap: true,
      minify: false,
    }),
  ],
  treeshake: isDev ? false : 'recommended',
  watch: { clearScreen: false, buildDelay: 50 },
});
