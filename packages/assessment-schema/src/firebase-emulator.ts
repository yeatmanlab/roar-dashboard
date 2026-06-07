/**
 * Firebase project ID used when running against the local Auth emulator.
 *
 * The emulator doesn't validate project IDs, but the Firebase SDK requires
 * a non-empty value. The `demo-` prefix is the Firebase emulator convention
 * for projects that don't correspond to a real Firebase project.
 */
export const FIREBASE_EMULATOR_PROJECT_ID = 'demo-roar' as const;

/**
 * Placeholder Firebase API key used when running against the local Auth emulator.
 *
 * The Firebase client SDK requires a non-empty apiKey before calling getAuth(),
 * but the emulator never validates it.
 */
export const FIREBASE_EMULATOR_API_KEY = 'emulator-api-key' as const;
