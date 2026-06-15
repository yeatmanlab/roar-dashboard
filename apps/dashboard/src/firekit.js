import { RoarFirekit } from '@bdelab/roar-firekit';

const isLocalhost = window.location.hostname === 'localhost';
const isCypress = window.Cypress;

// Define list of environment variables required for a successful Firekit initialization.
// @TODO: Check if we can remove this and rely on the firekit to handle this, incl. error handling.
const requiredEnvVars = [
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
if (missingEnvVars.length > 0) console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);

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
  VITE_FIREKIT_VERBOSE_LOGGING_ENABLED = false,
  VITE_FIREBASE_EMULATOR_ENABLED = false,
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
const firekitConfig = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Local Firebase Auth emulator support (opt-in via VITE_FIREBASE_EMULATOR_ENABLED).
//
// When enabled, Firekit points Firebase at the local Auth emulator instead of
// the live dev project. roar-firekit detects an EmulatorFirebaseConfig (one
// carrying `emulatorPorts`) and calls connectAuthEmulator internally during
// init(), so we don't have to reach into the Auth instances ourselves.
//
// The project id MUST match the backend's GCLOUD_PROJECT (demo-roar by default)
// so emulator-issued ID tokens verify through the same path as production.
// apiKey/siteKey are placeholders the emulator ignores.
//
// Only the Auth emulator is started by the local stack. The db/functions ports
// exist solely to satisfy roar-firekit's EmulatorFirebaseConfig shape — Firestore
// and Functions emulators are intentionally not run in this mode.
// ─────────────────────────────────────────────────────────────────────────────
const useFirebaseEmulator = VITE_FIREBASE_EMULATOR_ENABLED === true || VITE_FIREBASE_EMULATOR_ENABLED === 'true';

const emulatorProject = {
  projectId: import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT_ID || 'demo-roar',
  apiKey: 'fake-api-key',
  siteKey: 'fake-site-key',
  debugToken: APP_CHECK_DEBUG_TOKEN,
  emulatorPorts: {
    auth: Number(import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_PORT) || 9099,
    db: Number(import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT) || 8085,
    functions: Number(import.meta.env.VITE_FIREBASE_EMULATOR_FUNCTIONS_PORT) || 5001,
  },
};

// Both Firebase projects (admin + app) point at the same emulator instance and
// project id; the emulator keys its user pool by project id.
const emulatorFirekitConfig = {
  admin: emulatorProject,
  app: emulatorProject,
};

/**
 * Initialize a new Firekit instance.
 *
 * @returns {Promise<RoarFirekit>} A promise that resolves with the initialized Firekit instance.
 */
export async function initializeFirekit() {
  if (useFirebaseEmulator) {
    console.warn(
      '[firekit] Firebase Auth emulator mode is ON (VITE_FIREBASE_EMULATOR_ENABLED). ' +
        `Using project "${emulatorProject.projectId}" against the local Auth emulator. ` +
        'This must never be enabled in a deployed build.',
    );
  }

  const firekit = new RoarFirekit({
    roarConfig: useFirebaseEmulator ? emulatorFirekitConfig : firekitConfig,
    authPersistence: 'session',
    verboseLogging: VITE_FIREKIT_VERBOSE_LOGGING_ENABLED === true,
  });

  return await firekit.init();
}
