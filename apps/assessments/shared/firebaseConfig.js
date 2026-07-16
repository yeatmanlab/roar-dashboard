import {
  FIREBASE_EMULATOR_PROJECT_ID,
  FIREBASE_EMULATOR_API_KEY,
  FIREBASE_EMULATOR_STORAGE_BUCKET,
} from '@roar-platform/assessment-schema';

/**
 * Returns the Firebase config for the current environment.
 *
 * When the Auth emulator is active (assessment environment), only a projectId is
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
    // storageBucket is required for getStorage(getApp()) to resolve a default bucket: recording
    // uploads (e.g. Read Aloud) route to the local Storage emulator, which creates the bucket on
    // first write. Assessments that never upload simply don't call getStorage, so it's harmless.
    return {
      projectId: FIREBASE_EMULATOR_PROJECT_ID,
      apiKey: FIREBASE_EMULATOR_API_KEY,
      storageBucket: FIREBASE_EMULATOR_STORAGE_BUCKET,
    };
  }
  return fetch('/__/firebase/init.json').then((r) => r.json());
}
