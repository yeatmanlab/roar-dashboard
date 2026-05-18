/**
 * Returns the Firebase config for the current environment.
 *
 * When the Auth emulator is active (researcher environment), only a projectId is
 * needed — the emulator doesn't validate API keys or auth domains.
 *
 * In staging/production, Firebase Hosting serves the config at
 * /__/firebase/init.json automatically — no secrets in the build.
 *
 * @returns {Promise<object>} Firebase config object
 */
export async function getFirebaseConfig() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // The client SDK requires apiKey to be non-empty before calling getAuth(), but the
    // emulator never validates it. A placeholder satisfies the check without real credentials.
    return { projectId: 'demo-roar', apiKey: 'emulator-api-key' };
  }
  return fetch('/__/firebase/init.json').then((r) => r.json());
}
