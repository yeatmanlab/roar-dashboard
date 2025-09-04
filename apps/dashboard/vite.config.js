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
  const root = path.resolve(__dirname);
  const fbPath = path.join(root, 'firebase', 'admin', 'firebase.json');
  const FirebaseConfig = JSON.parse(fs.readFileSync(fbPath, 'utf-8'));
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

const buildFirebaseConfig = (mode = 'development') => {
  const allowedModes = ['test', 'development', 'staging', 'production'];
  if (!allowedModes.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Expected one of: ${allowedModes.join(', ')}`);
  }

  // The sentry environment uses "staging" for dev and test as well.
  const sentryEnvModeMap = {
    test: 'staging',
    development: 'staging',
    staging: 'staging',
    production: 'production',
  };
  const sentryEnv = sentryEnvModeMap[mode];

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname);

  // Validate required environment variables
  const requiredEnvVars = ['VITE_FIREBASE_ADMIN_PROJECT_ID', 'VITE_FIREBASE_APP_PROJECT_ID'];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missingEnvVars.length > 0) console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  const { VITE_FIREBASE_ADMIN_PROJECT_ID, VITE_FIREBASE_APP_PROJECT_ID } = process.env;

  // Utility function to replace environment variables in a string
  const replaceEnvVars = (str) => {
    return str
      .replace(/__SENTRY_ENV__/g, sentryEnv)
      .replace(/__ADMIN_PROJECT_ID__/g, VITE_FIREBASE_ADMIN_PROJECT_ID)
      .replace(/__ASSESSMENT_PROJECT_ID__/g, VITE_FIREBASE_APP_PROJECT_ID);
  };

  // Read and token-replace CSP template
  const cspTemplatePath = path.join(root, 'firebase', 'admin', 'csp.template.json');
  const cspTemplate = replaceEnvVars(fs.readFileSync(cspTemplatePath, 'utf8'));
  const cspObj = JSON.parse(cspTemplate);

  // Join arrays into single-line policy
  const cspPolicy = Object.entries(cspObj)
    .map(([dir, vals]) => `${dir} ${vals.join(' ')}`)
    .join('; ')
    .replace(/\s+/g, ' ')
    .trim();

  // Build firebase.json from firebase.template.json
  const fbTemplatePath = path.join(root, 'firebase', 'admin', 'firebase.template.json');
  const fbTemplate = replaceEnvVars(fs.readFileSync(fbTemplatePath, 'utf8'));
  const fbObj = JSON.parse(fbTemplate);

  // Replace header with the generated CSP policy
  const header = fbObj.hosting.headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === 'Content-Security-Policy-Report-Only');

  if (!header) throw new Error('CSP header not found');
  header.value = cspPolicy;

  // Write output
  const outPath = path.join(root, 'firebase', 'admin', 'firebase.json');
  fs.writeFileSync(outPath, JSON.stringify(fbObj, null, 2));
  console.log(`✅ Generated ${outPath} for environment ${mode}`);
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
  buildFirebaseConfig(mode);

  const responseHeaders = getResponseHeaders();

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
        ...responseHeaders,
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
            'roar-readaloud': ['@bdelab/roar-readaloud'],
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
