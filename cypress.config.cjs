const Vue = require('@vitejs/plugin-vue').default;
const { defineConfig } = require('cypress');
const { nodePolyfills } = require('vite-plugin-node-polyfills');
const vitePreprocessor = require('cypress-vite');
const UnheadVite = require('@unhead/addons/vite');
const path = require('path');
const fs = require('fs');

/**
 * Injects environment variables parsed by dotenvx into the Cypress environment.
 *
 * This is necessary as Cypress itself does not load environment variables from .env files. The dotenvx package is used
 * to load the .env files. To mimick the default Cypress behaviour, only inject the parsed variables that start with
 * CYPRESS_ and remove that prefix before setting them in the Cypress environment.
 *
 * @param {Object} config – The Cypress configuration object.
 * @returns {Object} The modified Cypress configuration object.
 */
const injectEnvVars = (config, envVars) => {
  // Inject environment variables parsed by dotenvx into the Cypress environment. This is necessary as Cypress
  // itself does not load environment variables from .env files. The dotenvx package is used to load the .env files
  // Note: To mimick the default Cypress behaviour, only inject the parsed variables that start with CYPRESS_ and
  // remove that prefix before setting them in the Cypress environment.
  for (const [key, value] of Object.entries(envVars)) {
    if (key.startsWith('CYPRESS_')) {
      config.env[key.replace('CYPRESS_', '')] = value;
    }
  }

  return config;
};

// Load environment variables
// Using a similar approach as in vite.config.js, we conditionally load the .env.test files from the env-configs/
// directory and the root of the project. This is done to properly support dotenvx.
let envFilePaths = [];
const mainTestEnv = path.resolve(__dirname, './env-configs/.env.test');
const fallbackTestEnv = path.resolve(__dirname, './.env.test');

if (fs.existsSync(mainTestEnv)) envFilePaths.push(mainTestEnv);
if (fs.existsSync(fallbackTestEnv)) envFilePaths.push(fallbackTestEnv);

const envConfig = require('@dotenvx/dotenvx').config({ path: envFilePaths });

module.exports = defineConfig({
  projectId: process.env.CYPRESS_PROJECT_ID,

  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'https://localhost:5173',
    experimentalRunAllSpecs: true,
    experimentalMemoryManagement: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      injectEnvVars(config, envConfig.parsed);

      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });

      on(
        'file:preprocessor',
        vitePreprocessor({
          mode: 'development',
        }),
      );

      require('cypress-fs/plugins')(on);

      return config;
    },
  },

  component: {
    viewportWidth: 1536,
    viewportHeight: 960,
    devServer: {
      framework: 'vue',
      bundler: 'vite',
      viteConfig: {
        resolve: {
          alias: {
            '@': path.resolve(__dirname, './src'),
          },
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
        ],
        server: {
          port: 5173,
          fs: {
            allow: ['..'],
          },
        },
        optimizeDeps: {
          include: ['@bdelab/roar-firekit', 'vue-google-maps-community-fork', 'fast-deep-equal'],
        },
      },
    },
    setupNodeEvents(on, config) {
      injectEnvVars(config, envConfig.parsed);
      require('cypress-fs/plugins')(on);
      return config;
    },
  },

  env: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'https://localhost:5173',
    firestoreUrl: 'https://firestore.googleapis.com/**/*',
    firestoreAdminUrl: 'https://firestore.googleapis.com/v1/projects/gse-roar-admin-dev/databases/(default)/documents',
    firestoreAppUrl:
      'https://firestore.googleapis.com/v1/projects/gse-roar-assessment-dev/databases/(default)/documents',
    timeout: 10000,
    superAdminUsername: process.env.CYPRESS_SUPER_ADMIN_USERNAME,
    superAdminPassword: process.env.CYPRESS_SUPER_ADMIN_PASSWORD,
    superAdminId: process.env.CYPRESS_SUPER_ADMIN_ID,
    partnerAdminUsername: process.env.CYPRESS_PARTNER_ADMIN_USERNAME,
    partnerAdminPassword: process.env.CYPRESS_PARTNER_ADMIN_PASSWORD,
    partnerAdminId: process.env.CYPRESS_PARTNER_ADMIN_ID,
    participantUsername: process.env.CYPRESS_PARTICIPANT_USERNAME,
    participantPassword: process.env.CYPRESS_PARTICIPANT_PASSWORD,
    participantUid: process.env.CYPRESS_PARTICIPANT_UID,
    participantEmail: process.env.CYPRESS_PARTICIPANT_EMAIL,
    participantEmailPassword: process.env.CYPRESS_PARTICIPANT_EMAIL_PASSWORD,
    cleverOAuthLink: 'https://clever.com/oauth/authorize',
    cleverSchoolName: '61e8aee84cf0e71b14295d45',
    cleverUsername: process.env.CYPRESS_CLEVER_USERNAME,
    cleverPassword: process.env.CYPRESS_CLEVER_PASSWORD,
    testAdministrationName: 'Cypress Test Administration',
    testAdministrationId: 'kKUSypkMc36mPEzleDE6',
    testAdministratorFirstName: 'Cypress Test Administrator First Name',
    testAdministratorMiddleName: 'Cypress Test Administrator Middle Name',
    testAdministratorLastName: 'Cypress Test Administrator Last Name',
    testAdministratorEmail: 'CypressTestAdministratorEmail',
    testDistrictName: 'Cypress Test District',
    testDistrictInitials: 'SATD',
    testDistrictNcesId: '0123456789',
    testDistrictId: 'qoW9OEPcV50rIA2IcqbV',
    testSchoolName: 'Cypress Test School',
    testSchoolInitials: 'SATS',
    testSchoolNcesId: '0123456789',
    testClassName: 'Cypress Test Class',
    testClassInitials: 'SATC',
    testGroupName: 'Cypress Test Group',
    testGroupInitials: 'SATG',
    testAssignmentsList: [
      'ROAR - Letter',
      'ROAR - Picture Vocab',
      'ROAM - Math Facts Fluency',
      'ROAM - Calculation Fluency',
      'ROAR - Syntax',
      'ROAR - Phoneme',
      'ROAR - Word',
      'ROAR - Sentence',
      'ROAR - Morphology',
    ],
    testPartnerAdministrationName: 'Partner Test Administration',
    testPartnerAdministrationId: 'kKUSypkMc36mPEzleDE6',
    testPartnerDistrictName: 'Cypress Test District',
    testPartnerDistrictInitials: 'CTD',
    testPartnerDistrictNcesId: '0123456789',
    testPartnerSchoolName: 'Cypress Test School',
    testPartnerSchoolInitials: 'CTD-CTS',
    testPartnerSchoolNcesId: '0123456789',
    testPartnerClassName: 'Cypress Test Class',
    testPartnerClassInitials: 'CTD-CTS-CTC',
    testPartnerGroupName: 'Cypress Test Group',
    testPartnerGroupInitials: 'CTG',
    testGrade: 'Grade 5',
    stanfordUniversityAddress: '450 Jane Stanford Way, Stanford, CA 94305, USA',
    testTag: 'stanford university',
    cypressDownloads: 'cypress/downloads',
    testRoarAppsAdministration: 'Cypress Test Roar Apps Administration',
    testRoarAppsAdministrationId: 'K8UaI8p79Dntj5Z2CJk8',
    testOptionalRoarAppsAdministration: 'Cypress Test Optional Roar Apps Administration',
    testOptionalRoarAppsAdministrationId: 'Fuy4nQaMu6YmfNg1eBYH',
    testSpanishRoarAppsAdministration: 'Cypress Test Spanish Roar Apps Administration',
    testSpanishRoarAppsAdministrationId: '',
    // Generate a list of test users CypressTestStudent0, CypressTestStudent1, ..., CypressTestStudent50 and push the test_legal_doc user
    testUserList: (() => {
      const list = Array.from({ length: 51 }, (_, i) => `CypressTestStudent${i}`);
      list.push('test_legal_doc');
      return list;
    })(),
    roarDemoDistrictName: 'Roar Demo District',
    roarDemoDistrictId: 'dfyDUItJNf3wEoG6Mf8H',
    roarDemoAdministrationName: 'ROAR demo administration',
    roarDemoAdministrationId: 'EWC9corgcnipev7ZnmuN',
  },
});
