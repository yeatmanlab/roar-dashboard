import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';
import mkcert from 'vite-plugin-mkcert';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import UnheadVite from '@unhead/addons/vite';
import { default as FirebaseConfig } from './firebase.json';

// Parse headers from firebase.json
const stagingHostingConfig = FirebaseConfig.hosting.find((entry) => entry.target === 'staging');
const parsedStagingResponseHeaders = stagingHostingConfig.headers[0].headers.reduce((acc, header) => {
  // Modify the Content-Security-Policy header as follows:
  // - Drop the default CSP in favour of the strict CSP from the Report-Only header for local development
  // - Drop the report-uri and report-to CSP directives to prevent Sentry logging for local development
  // - Drop the Report-To header to prevent Sentry logging for local development
  if (header.key === 'Content-Security-Policy-Report-Only') {
    acc['Content-Security-Policy'] = header.value
      .replace(/report-uri\s*[^;]+;/, '')
      .replace(/report-to\s*[^;]+/, '')
      .trim();
  } else if (header.key !== 'Report-To') {
    acc[header.key] = header.value;
  }
  return acc;
}, {});

// Vite configuration
// @see https://vitejs.dev/config/
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
    headers: {
      ...parsedStagingResponseHeaders,
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
          roam: ['@bdelab/roam-apps'],
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
    include: [
      '@bdelab/roar-firekit',
      'vue-google-maps-community-fork',
      'fast-deep-equal', // Required due to https://github.com/nathanap/vue-google-maps-community-fork/issues/4
    ],
  },
});
