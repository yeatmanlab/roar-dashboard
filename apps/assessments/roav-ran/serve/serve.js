import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import TaskLauncher from '../src/experiment/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig.js';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Task selection: variantId wins; otherwise taskId resolves to the first published variant.
// roav-ran is English-only, so the task slug is used directly (no language suffix).
const taskId = urlParams.get('task') ?? 'ran';
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Participant context from the launch URL. The operator-entered PID goes to run metadata and
// the recording path — never the user record.
const assessmentPid = urlParams.get('participant') ?? '';
const grade = urlParams.get('grade');
// Dev-only locale override; roav-ran ships English only (i18next defaults to en).
const languageOverride = urlParams.get('lng');

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

      // Provision the anonymous ROAR user and resolve a variant via the SDK.
      // variantId wins; otherwise falls back to the first published variant for taskId.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks },
        { ...(variantId ? { variantId } : {}), taskId },
      );

      const ctx = {
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

      // Variant-authoritative: game params come entirely from the seeded variant. Its params
      // include `taskName`, which TaskLauncher reads to route to taskConfig[camelize(taskName)],
      // so a variant missing taskName would fail task resolution.
      const gameParams = { ...variantParams };

      // Participant params from the launch URL. The dev locale override is layered here and
      // wins over any variant `language` because initConfig merges userParams after gameParams.
      const userParams = {
        assessmentPid,
        grade,
        ...(languageOverride ? { language: languageOverride } : {}),
      };

      const task = new TaskLauncher(gameParams, userParams);
      task.run();
    } catch (err) {
      console.error('[roav-ran] Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
