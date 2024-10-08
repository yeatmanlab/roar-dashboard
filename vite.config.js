import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import Vue from '@vitejs/plugin-vue';
import mkcert from 'vite-plugin-mkcert';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import UnheadVite from '@unhead/addons/vite';
import { config } from '@dotenvx/dotenvx';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files following the default Vite priority rules.
  const env = loadEnv(mode, process.cwd(), '');

  // Process encrypted environment variables using dotenvx.
  // @NOTE: We're using "nextjs" as convention as dotenvx does not support a "vite" convention yet, but both are close
  // to identical in terms of how they prioritize environment variables.
  config({ env, convention: 'nextjs' });

  return {
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
  };
});
