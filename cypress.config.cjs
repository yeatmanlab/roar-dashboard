const Vue = require('@vitejs/plugin-vue').default;
const { defineConfig } = require('cypress');
const { nodePolyfills } = require('vite-plugin-node-polyfills');
const vitePreprocessor = require('cypress-vite');
const UnheadVite = require('@unhead/addons/vite');
const path = require('path');

// Load environment variables from .env.test located in the root of the project
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

module.exports = defineConfig({
  projectId: 'cobw62',

  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'https://localhost:5173',
    experimentalRunAllSpecs: true,
    experimentalMemoryManagement: true,
    retries: 2,
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
      on('file:preprocessor', vitePreprocessor());
      return require('./node_modules/cypress-fs/plugins/index.js')(on, config);
    },
  },

  component: {
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
      return require('./node_modules/cypress-fs/plugins/index.js')(on, config);
    },
  },

  env: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'https://localhost:5173',
    firestoreUrl: 'https://firestore.googleapis.com/**/*',
    firestoreAdminUrl: 'https://firestore.googleapis.com/v1/projects/gse-roar-admin-dev/databases/(default)/documents',
    firestoreAppUrl:
      'https://firestore.googleapis.com/v1/projects/gse-roar-assessment-dev/databases/(default)/documents',
    timeout: 10000,
    sessionCookieName: process.env.SESSION_COOKIE_NAME,
    sessionCookieValue: process.env.SESSION_COOKIE_VALUE,
    superAdminUsername: process.env.SUPER_ADMIN_USERNAME,
    superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,
    superAdminId: process.env.SUPER_ADMIN_ID,
    partnerAdminUsername: process.env.PARTNER_ADMIN_USERNAME,
    partnerAdminPassword: process.env.PARTNER_ADMIN_PASSWORD,
    partnerAdminId: process.env.PARTNER_ADMIN_ID,
    participantUsername: process.env.PARTICIPANT_USERNAME,
    participantPassword: process.env.PARTICIPANT_PASSWORD,
    participantUid: process.env.PARTICIPANT_UID,
    participantEmail: process.env.PARTICIPANT_EMAIL,
    participantEmailPassword: process.env.PARTICIPANT_EMAIL_PASSWORD,
    cleverOAuthLink: 'https://clever.com/oauth/authorize',
    cleverSchoolName: '61e8aee84cf0e71b14295d45',
    cleverUsername: process.env.CLEVER_USERNAME,
    cleverPassword: process.env.CLEVER_PASSWORD,
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
    parentFirstName: process.env.PARENT_FIRST_NAME,
    parentLastName: process.env.PARENT_LAST_NAME,
    parentEmail: process.env.PARENT_EMAIL,
    parentPassword: process.env.PARENT_PASSWORD,
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
    appCheckDebugToken: process.env.VITE_APPCHECK_DEBUG_TOKEN,
  },
});
