import { RoarFirekit } from '@bdelab/roar-firekit';
import * as AdminFirebaseConfig from '../firebase/admin/firebase.json';
import * as AppFirebaseConfig from '../firebase/assessment/firebase.json';

const isLocalhost = window.location.hostname === 'localhost';
const isCypress = window.Cypress;

// Define list of environment variables required for a successful Firekit initialization.
// @TODO: Check if we can remove this and rely on the firekit to handle this, incl. error handling.
const requiredEnvVars = import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED
  ? ['VITE_FIREBASE_ADMIN_PROJECT_ID']
  : [
      // Admin config:
      'VITE_FIREBASE_ADMIN_PROJECT_ID',
      'VITE_FIREBASE_ADMIN_API_KEY',
      'VITE_FIREBASE_ADMIN_AUTH_DOMAIN',
      'VITE_FIREBASE_ADMIN_STORAGE_BUCKET',
      'VITE_FIREBASE_ADMIN_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_ADMIN_APP_ID',
      // App config:
      'VITE_FIREBASE_APP_PROJECT_ID',
      'VITE_FIREBASE_APP_API_KEY',
      'VITE_FIREBASE_APP_AUTH_DOMAIN',
      'VITE_FIREBASE_APP_STORAGE_BUCKET',
      'VITE_FIREBASE_APP_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_APP_ID',
    ];

// Check if all required environment variables are set
const missingEnvVars = requiredEnvVars.filter((envVar) => !import.meta.env[envVar]);
if (missingEnvVars.length > 0) throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);

const {
  VITE_FIREBASE_ADMIN_PROJECT_ID,
  VITE_FIREBASE_ADMIN_APP_ID,
  VITE_FIREBASE_ADMIN_API_KEY,
  VITE_FIREBASE_ADMIN_AUTH_DOMAIN,
  VITE_FIREBASE_ADMIN_STORAGE_BUCKET,
  VITE_FIREBASE_ADMIN_MESSAGING_SENDER_ID,
  VITE_FIREKIT_ADMIN_RECAPTCHA_SITE_KEY,
  VITE_ANALYTICS_ADMIN_MEASUREMENT_ID,
  VITE_FIREBASE_APP_PROJECT_ID,
  VITE_FIREBASE_APP_APP_ID,
  VITE_FIREBASE_APP_API_KEY,
  VITE_FIREBASE_APP_AUTH_DOMAIN,
  VITE_FIREBASE_APP_STORAGE_BUCKET,
  VITE_FIREBASE_APP_MESSAGING_SENDER_ID,
  VITE_FIREKIT_APP_RECAPTCHA_SITE_KEY,
  VITE_FIREKIT_APPCHECK_DEBUG_TOKEN = undefined,
  VITE_FIREKIT_VERBOSE_LOGGING_ENABLED = false, // @TODO: Parse as bools!
  VITE_FIREBASE_EMULATOR_ENABLED = false, // @TODO: Parse as bools!
} = import.meta.env;

// Define the App Check debug token
// Debug tokens are only allowed in the local development environment and in Cypress tests. If the token environment
// variable is set to 'true', we pass on the boolean value in order to generate a new debug token. Otherwise, we pass on
// the value of the environment variable to allow engineers to set their own personal debug token.
const APP_CHECK_DEBUG_TOKEN =
  isLocalhost || isCypress
    ? VITE_FIREKIT_APPCHECK_DEBUG_TOKEN === 'true'
      ? true
      : VITE_FIREKIT_APPCHECK_DEBUG_TOKEN
    : undefined;

// Define the Firekit configuration object
// If the project is running in the emulator, only a subset of the configuration is required. Otherwise, the ROAR
// Firekit requires the full configuration object to be passed in during initialization.
const firekitConfig = VITE_FIREBASE_EMULATOR_ENABLED
  ? {
      admin: {
        projectId: `demo-${VITE_FIREBASE_ADMIN_PROJECT_ID}`,
        apiKey: 'fake-admin-emulator-api-key',
        emulatorPorts: {
          db: AdminFirebaseConfig.emulators.firestore.port,
          auth: AdminFirebaseConfig.emulators.auth.port,
          functions: AdminFirebaseConfig.emulators.functions.port,
        },
      },
      app: {
        projectId: `demo-${VITE_FIREBASE_APP_PROJECT_ID}`,
        apiKey: 'fake-app-emulator-api-key',
        emulatorPorts: {
          db: AppFirebaseConfig.emulators.firestore.port,
          auth: AppFirebaseConfig.emulators.auth.port,
          functions: AppFirebaseConfig.emulators.functions.port,
        },
      },
    }
  : {
      admin: {
        projectId: VITE_FIREBASE_ADMIN_PROJECT_ID,
        appId: VITE_FIREBASE_ADMIN_APP_ID,
        apiKey: VITE_FIREBASE_ADMIN_API_KEY,
        authDomain: VITE_FIREBASE_ADMIN_AUTH_DOMAIN,
        storageBucket: VITE_FIREBASE_ADMIN_STORAGE_BUCKET,
        messagingSenderId: VITE_FIREBASE_ADMIN_MESSAGING_SENDER_ID,
        siteKey: VITE_FIREKIT_ADMIN_RECAPTCHA_SITE_KEY,
        debugToken: APP_CHECK_DEBUG_TOKEN,
        measurementId: VITE_ANALYTICS_ADMIN_MEASUREMENT_ID,
      },
      app: {
        projectId: VITE_FIREBASE_APP_PROJECT_ID,
        appId: VITE_FIREBASE_APP_APP_ID,
        apiKey: VITE_FIREBASE_APP_API_KEY,
        authDomain: VITE_FIREBASE_APP_AUTH_DOMAIN,
        storageBucket: VITE_FIREBASE_APP_STORAGE_BUCKET,
        messagingSenderId: VITE_FIREBASE_APP_MESSAGING_SENDER_ID,
        siteKey: VITE_FIREKIT_APP_RECAPTCHA_SITE_KEY,
        debugToken: APP_CHECK_DEBUG_TOKEN,
      },
    };

/**
 * Initialize a new Firekit instance.
 *
 * @returns {Promise<RoarFirekit>} A promise that resolves with the initialized Firekit instance.
 */
export async function initializeFirekit() {
  const firekit = new RoarFirekit({
    roarConfig: firekitConfig,
    authPersistence: 'session',
    markRawConfig: {
      // @TODO: Check what this is for?
      auth: false,
      db: false,
      functions: false,
    },
    verboseLogging: VITE_FIREKIT_VERBOSE_LOGGING_ENABLED,
  });

  return await firekit.init();
}
