import { log } from '../src/experiment/config/logger';

// Firebase config values are injected at build time by webpack DefinePlugin.
// Secret values are sourced from GitHub environment secrets (VITE_FIREBASE_APP_*)
// and are the same projects used by the dashboard.
// eslint-disable-next-line no-undef
export const firebaseConfig = {
  // eslint-disable-next-line no-undef
  apiKey: FIREBASE_APP_API_KEY,
  // eslint-disable-next-line no-undef
  authDomain: FIREBASE_APP_AUTH_DOMAIN,
  // eslint-disable-next-line no-undef
  projectId: FIREBASE_APP_PROJECT_ID,
  // eslint-disable-next-line no-undef
  storageBucket: FIREBASE_APP_STORAGE_BUCKET,
  // eslint-disable-next-line no-undef
  messagingSenderId: FIREBASE_APP_MESSAGING_SENDER_ID,
  // eslint-disable-next-line no-undef
  appId: FIREBASE_APP_APP_ID,
  // eslint-disable-next-line no-undef
  siteKey: FIREBASE_APP_SITE_KEY,
};

export const roarConfig = { firebaseConfig };

// eslint-disable-next-line no-undef
log.info(`This ROAR app will write data to the ${FIREBASE_APP_PROJECT_ID} firestore database`);
