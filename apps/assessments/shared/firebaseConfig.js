// eslint-disable-next-line no-undef
const isDev = ROAR_DB === 'development';

/**
 * Returns the Firebase config for the current environment.
 *
 * In development, values come from the researcher's local .env file,
 * injected at build time by webpack EnvironmentPlugin.
 *
 * In staging/production, Firebase Hosting serves the app's config at
 * /__/firebase/init.json automatically — no secrets in the build.
 *
 * @returns {Promise<object>} Firebase config object
 */
export async function getFirebaseConfig() {
  if (isDev) {
    return {
      apiKey: process.env.FIREBASE_APP_API_KEY,
      authDomain: process.env.FIREBASE_APP_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_APP_PROJECT_ID,
      storageBucket: process.env.FIREBASE_APP_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_APP_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_APP_ID,
      siteKey: process.env.FIREBASE_APP_RECAPTCHA_SITE_KEY,
    };
  }
  return fetch('/__/firebase/init.json').then((r) => r.json());
}
