import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import mkcert from 'vite-plugin-mkcert';
import Vue from '@vitejs/plugin-vue';
import UnheadVite from '@unhead/addons/vite';
import { config } from '@dotenvx/dotenvx';
import { fileURLToPath, URL } from 'url';
import path from 'path';
import fs from 'fs';
import { default as FirebaseConfig } from './firebase/admin/firebase.staging.json';

/**
 * Parse server response headers
 *
 * The function parses the response headers configured in the Firebase hosting configuration in order to inject those
 * headers into the Vite dev server configuration. Additionally, we modify the Content-Security-Policy header to:
 * - Drop the default CSP in favour of the strict CSP from the Report-Only header for local development
 * - Drop the report-uri and report-to CSP directives to prevent Sentry logging for local development
 * - Drop the Report-To header to prevent Sentry logging for local development
 *
 * @returns {Object} The parsed response headers
 */
function getResponseHeaders() {
  // Find the staging hosting config
  const stagingHostingConfig = FirebaseConfig.hosting;

  if (!stagingHostingConfig) {
    console.warn('No staging configuration found in firebase.json');
    return {};
  }

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

  return parsedStagingResponseHeaders;
}

/**
 * Load dotenv files
 *
 * This function extends the default Vite behaviour for dotenv files by loading environment variables from dotenv files
 * located in the env-configs/ directory. This directory is a submodule containing environment-specific dotenv files,
 * all encrypted using dotenvx. This function will load the dotenv file corresponding to the current mode (development,
 * production, etc.) as well as the local mode override file and decrypt the contents into process.env for Vite to use.
 *
 * It is worth noting that any fork of the project not using the env-configs submodule can safely use a regular dotenv
 * file at the root of the project, as Vite will automatically load it.
 *
 * @returns {void}
 */
const loadDotenvFiles = (mode) => {
  let envFilePaths = [];
  const allowOverride = !mode.includes('production') && !mode.includes('staging');

  const modeEnvFilePath = path.resolve(__dirname, `./env-configs/.env.${mode}`);
  const modeLocalEnvFileName = path.resolve(__dirname, `./env-configs/.env.${mode}.local`);

  if (fs.existsSync(modeEnvFilePath)) envFilePaths.push(modeEnvFilePath);
  if (allowOverride & fs.existsSync(modeLocalEnvFileName)) envFilePaths.push(modeLocalEnvFileName);

  config({
    path: envFilePaths,
    override: allowOverride,
  });
};

/**
 * Vite configuration
 *
 * @param {Object} options - Options object passed to defineConfig.
 * @param {string} options.mode - The current mode (development, production, etc.).
 * @returns {Object} The Vite configuration object.
 */
export default defineConfig(({ mode }) => {
  // Trigger custom dotenv file loader for env-configs directory.
  loadDotenvFiles(mode);

  // Return default Vite configuration.
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
            // @TODO: Modify to use environment variables for Sentry configuration.
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
        ...getResponseHeaders(),
      },
    },

    preview: {
      port: 4173,
      strictPort: process.env.CI === 'true' ? true : false,
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
