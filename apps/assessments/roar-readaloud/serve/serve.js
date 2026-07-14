import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { READALOUD_TASK_ID } from '@roar-platform/assessment-schema/roar-readaloud';
import ReadAloudTask from '../src/experiment/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Participant / session. The variant carries all game params — serve.js no longer parses
// them from the URL; it resolves the variant and hands its params to the task.
const assessmentPid = urlParams.get('participant') ?? '';
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Demographics / lab identifiers — threaded through as run metadata (see startRun).
const labId = urlParams.get('labId');
const grade = urlParams.get('grade') ? parseInt(urlParams.get('grade'), 10) : null;
const birthYear = urlParams.get('birthyear') ? parseInt(urlParams.get('birthyear'), 10) : null;
const birthMonth = urlParams.get('birthmonth') ? parseInt(urlParams.get('birthmonth'), 10) : null;
const age = urlParams.get('age') ? parseFloat(urlParams.get('age')) : null;
const ageMonths = urlParams.get('agemonths') ? parseFloat(urlParams.get('agemonths')) : null;

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
      // The variantId URL param wins; otherwise it falls back to the first published variant.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        // eslint-disable-next-line no-undef
        { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks },
        { ...(variantId ? { variantId } : {}), taskId: READALOUD_TASK_ID },
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

      const userParams = { assessmentPid, labId, grade, birthMonth, birthYear, age, ageMonths };

      const task = new ReadAloudTask(variantParams, userParams, {
        assessmentPid,
        assessmentUid: user.uid,
      });
      task.run();
    } catch (err) {
      console.error('[roar-readaloud] Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
