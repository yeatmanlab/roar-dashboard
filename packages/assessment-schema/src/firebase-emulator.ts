/**
 * Local Firebase emulator identifiers.
 *
 * **These look like deployment configuration but are shared vocabulary, and they stay here.**
 *
 * Their whole purpose is that two independent processes agree on the same local project:
 * `apps/backend/src/clients/firebase-core.client.ts` initializes Firebase Admin with
 * `FIREBASE_EMULATOR_PROJECT_ID`, and `apps/assessments/shared/firebaseConfig.js` initializes
 * the client SDK with the same value. If they disagree, emulator auth silently fails to
 * associate tokens with users — structurally the same class of cross-party agreement as a
 * `tasks.slug`, which is why this belongs in the schema package rather than in per-host
 * configuration.
 *
 * They are also not host-specific in the way ROAR's buckets and GCP projects are: an alternate
 * host running the Firebase emulator suite would use these same conventional values, and one
 * running no emulator never reads them at all. Nothing here names real ROAR infrastructure.
 */

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

/**
 * Default Firebase Storage bucket used when running against the local Storage emulator.
 *
 * `getStorage(getApp())` needs a default bucket to resolve; the emulator creates it on the
 * first upload, so the exact name only needs to be stable. Uses the conventional
 * `<projectId>.appspot.com` default-bucket form for the `demo-roar` emulator project.
 */
export const FIREBASE_EMULATOR_STORAGE_BUCKET = 'demo-roar.appspot.com' as const;
