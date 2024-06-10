import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import vitePluginFaviconsInject from 'vite-plugin-favicons-inject';
import Vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
    }),
    VitePWA({
      manifest: {
        // Modify manifest options here...
        name: 'ROAR Dashboard',
        short_name: 'ROAD',
        start_url: '.',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Add more manifest options as needed
      },
      /* enable sw on development */
      devOptions: {
        enabled: true,
        /* other options */
      },
      // Enable auto-generated icons
      generate: {
        // Set the source image for icon generation
        // Optionally specify the output directory for generated icons
        // output: '/path/to/output/directory'
      },
      registerType: 'autoUpdate',
    }),
    vitePluginFaviconsInject('./src/assets/roar-icon.svg'),
    ...(process.env.NODE_ENV === 'development' ? [basicSsl()] : []),
    nodePolyfills({
      globals: {
        process: true,
      },
    }),
    sentryVitePlugin({
      org: 'roar-89588e380',
      project: 'dashboard',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
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
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@bdelab/roar-firekit', 'vue-google-maps-community-fork', 'fast-deep-equal'],
  },
});
