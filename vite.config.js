import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import vitePluginFaviconsInject from 'vite-plugin-favicons-inject';
import Vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import legacy from '@vitejs/plugin-legacy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
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
    // For production build environments only
    legacy({
      /**
       * Expected compatible target browser version range
       *
       * The example here is in the configuration format of browserslist
       * (https://github.com/browserslist/browserslist)
       */
      targets: ['chrome >= 64', 'edge >= 79', 'safari >= 11.1', 'firefox >= 67'],
      /**
       * Whether to generate legacy browser compatibility chunks
       *
       * The examples here are only compatible with modern browsers, so it is not necessary to generate
       */
      renderLegacyChunks: false,
      /**
       * Polyfills required by modern browsers
       *
       * Since some low-version modern browsers do not support the new syntax
       * You need to load polyfills corresponding to the syntax to be compatible
       * At build, the required polyfills are packaged according to the target browser version range
       *
       * Two configuration methods:
       *
       * 1. true
       *  - Auto detect required polyfills based on target browser version range
       *  - Demerit: will introduce polyfills that are not needed by modern browsers in higher versions,
       *    as well as more aggressive polyfills.
       *
       * 2. string[]
       *  - Add low-version browser polyfills as needed
       *  - Example: ['es/global-this', 'proposals/object-from-entries']
       *  - Demerit: It needs to be added manually, which is inflexible;
       *    it will be discovered after the production is deployed, resulting in production failure! ! !
       */
      modernPolyfills: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  build: {
    /**
     * The final built browser-compatible target, minimum support to es2015
     *
     * Note: In vite v3.0 and above, this value may be overridden by @vitejs/plugin-legacy
     */
    target: 'es2015',
    /**
     * Configure the css compression target separately, or use the default configuration
     *
     * Note: This option has a different default value in vite and @vitejs/plugin-legacy
     */
    cssTarget: 'chrome61',
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
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@bdelab/roar-firekit', 'vue-google-maps-community-fork', 'fast-deep-equal'],
  },
});
