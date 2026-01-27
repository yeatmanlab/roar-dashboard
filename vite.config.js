import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'url';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';
import mkcert from 'vite-plugin-mkcert';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import UnheadVite from '@unhead/addons/vite';
import * as child from 'child_process';

const commitHash = child.execSync('git rev-parse --short HEAD').toString();
const require = createRequire(import.meta.url);

const copyPrimeiconsFonts = () => {
  const primeiconsDir = path.dirname(require.resolve('primeicons/primeicons.css'));
  const sourceDir = path.join(primeiconsDir, 'fonts');
  const targetDir = fileURLToPath(new URL('./public/fonts', import.meta.url));

  if (!fs.existsSync(sourceDir)) return;

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    fs.copyFileSync(path.join(sourceDir, entry), path.join(targetDir, entry));
  }
};

const primeiconsFontsPlugin = () => ({
  name: 'primeicons-fonts',
  buildStart: copyPrimeiconsFonts,
  configureServer: copyPrimeiconsFonts,
});

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(commitHash),
    'import.meta.env.VITE_LEVANTE': JSON.stringify('TRUE'),
  },
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    nodePolyfills({
      globals: {
        process: true,
      },
    }),
    UnheadVite(),
    ...(process.env.VITE_HTTPS === 'TRUE' ? [mkcert()] : []),
    primeiconsFontsPlugin(),
    ...(process.env.NODE_ENV !== 'development'
      ? [
          sentryVitePlugin({
            org: 'roar-89588e380',
            project: 'dashboard',
          }),
        ]
      : []),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    fs: {
      allow: ['..'],
    },
    https: process.env.VITE_HTTPS === 'TRUE',
  },

  build: {
    cssCodeSplit: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          lodash: ['lodash'],
          tanstack: ['@tanstack/vue-query'],
          chartJs: ['chart.js'],
          sentry: ['@sentry/browser', '@sentry/integrations', '@sentry/vue'],
          phoneme: ['@bdelab/roar-pa'],
          sre: ['@bdelab/roar-sre'],
          swr: ['@bdelab/roar-swr'],
          utils: ['@bdelab/roar-utils'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@levante-framework/firekit'],
    esbuildOptions: {
      mainFields: ['module', 'main'],
      resolveExtensions: ['.js', '.mjs', '.cjs'],
    },
  },
});
