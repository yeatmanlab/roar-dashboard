/**
 * Firebase project ID used in the local researcher environment (Auth emulator mode).
 *
 * The emulator doesn't validate project IDs, but Firebase SDK initialization requires
 * a non-empty value. The `demo-` prefix is the Firebase emulator convention for
 * projects that don't correspond to a real Firebase project.
 */
export const RESEARCHER_LOCAL_FIREBASE_PROJECT_ID = 'demo-roar' as const;

/**
 * Placeholder Firebase API key used in the local researcher environment (Auth emulator mode).
 *
 * The Firebase client SDK requires a non-empty apiKey before calling getAuth(), but the
 * emulator never validates it.
 */
export const RESEARCHER_LOCAL_FIREBASE_API_KEY = 'emulator-api-key' as const;
