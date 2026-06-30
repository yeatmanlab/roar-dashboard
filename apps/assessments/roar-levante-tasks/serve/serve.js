import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig.js';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Participant / session
const pid = urlParams.get('pid');
const labId = urlParams.get('labId');
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Demographics
const grade = urlParams.get('grade');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age') === null ? null : parseInt(urlParams.get('age'), 10);

// Optional language override. variantParams.language is authoritative for production;
// this allows standalone/dev users to test a specific locale without creating a new variant.
// setSharedConfig spreads userParams after variantParams, so this wins when present.
const languageOverride = urlParams.get('lng');

// Optional version override. Allows dev/test callers to force a specific task version
// (e.g. ?version=1 or ?version=2) without creating a separate variant in the database.
// variantParams.version is authoritative in production; this URL param wins when present.
const versionOverride = urlParams.get('version');

// Task selection: variantId wins; otherwise taskId resolves to the first published variant for that task.
const taskId = urlParams.get('task') ?? 'egma-math';

const firebaseConfig = await getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const authCallbacks = { getToken: () => user.getIdToken() };

      // Provision the anonymous ROAR user (and resolve a variant) via the SDK.
      // The variantId URL param wins; otherwise falls back to the first published variant for taskId.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        // eslint-disable-next-line no-undef
        { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks },
        { ...(variantId ? { variantId } : {}), taskId },
      );

      const ctx = {
        // eslint-disable-next-line no-undef
        baseUrl: ROAR_API_BASE_URL,
        auth: authCallbacks,
        participant: { participantId },
      };

      initFirekitCompat(ctx, {
        variantId: resolvedVariantId,
        taskVersion,
        isAnonymous: true,
      });

      const { variantParams } = await getVariantById(resolvedVariantId);

      const userParams = {
        pid,
        labId,
        grade,
        birthMonth,
        birthYear,
        age,
        ...(languageOverride ? { language: languageOverride } : {}),
        ...(versionOverride !== null ? { version: Number(versionOverride) } : {}),
      };

      // eslint-disable-next-line no-undef
      const isDev = ROAR_DB === 'development';
      const task = new TaskLauncher(variantParams, userParams, isDev);
      task.run();
    } catch (err) {
      console.error('[roar-levante-tasks] Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
