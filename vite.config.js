import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';
import mkcert from 'vite-plugin-mkcert';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import UnheadVite from '@unhead/addons/vite';

// https://vitejs.dev/config/
export default defineConfig({
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
    ...(process.env.NODE_ENV === 'development' ? [mkcert()] : []),
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
          sentry: ['@sentry/browser', '@sentry/integrations', '@sentry/vue', '@sentry/wasm'],
          fluency: ['@bdelab/roam-fluency'],
          firekit: ['@bdelab/roar-firekit'],
          letter: ['@bdelab/roar-letter'],
          multichoice: ['@bdelab/roar-multichoice'],
          phoneme: ['@bdelab/roar-pa'],
          sre: ['@bdelab/roar-sre'],
          swr: ['@bdelab/roar-swr'],
          utils: ['@bdelab/roar-utils'],
          vocab: ['@bdelab/roar-vocab'],
          ran: ['@bdelab/roav-ran'],
          crowding: ['@bdelab/roav-crowding'],
          'roav-mep': ['@bdelab/roav-mep'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@bdelab/roar-firekit', 'vue-google-maps-community-fork', 'fast-deep-equal'],
  },
});
