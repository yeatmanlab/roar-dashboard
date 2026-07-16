import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { getMultichoiceTaskId } from '@roar-platform/assessment-schema/roar-multichoice';
import RoarMultichoice from '../src/experiment/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { mountVariantPicker } from '../../shared/variantPicker.js';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Task family — 'morphology' or 'cva' (English only)
const task = urlParams.get('task') ?? 'morphology';
const taskId = getMultichoiceTaskId(task);

// Participant / session
const assessmentPid = urlParams.get('participant');
const labId = urlParams.get('labId');
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Demographics
const grade = urlParams.get('grade') ? parseInt(urlParams.get('grade'), 10) : null;
const birthYear = urlParams.get('birthyear') ? parseInt(urlParams.get('birthyear'), 10) : null;
const birthMonth = urlParams.get('birthmonth') ? parseInt(urlParams.get('birthmonth'), 10) : null;
const age = urlParams.get('age') ? parseFloat(urlParams.get('age')) : null;
const ageMonths = urlParams.get('agemonths') ? parseFloat(urlParams.get('agemonths')) : null;

// App config
const firebaseConfig = await getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const baseUrl = ROAR_API_BASE_URL;

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
        { baseUrl, auth: authCallbacks },
        { ...(variantId ? { variantId } : {}), taskId },
      );

      const ctx = {
        baseUrl,
        auth: authCallbacks,
        participant: { participantId },
      };

      initFirekitCompat(ctx, {
        variantId: resolvedVariantId,
        taskVersion,
        isAnonymous: true,
      });

      // Dev/staging only: mount a variant switcher so reviewers can hop between published
      // variants without hand-editing the URL. No-op in production (guard is eliminated at build).
      if (ROAR_DB !== 'production') {
        mountVariantPicker({
          baseUrl,
          auth: authCallbacks,
          taskId,
          currentVariantId: resolvedVariantId,
        });
      }

      const { variantParams } = await getVariantById(resolvedVariantId);

      const userParams = {
        assessmentPid,
        labId,
        grade,
        birthMonth,
        birthYear,
        age,
        ageMonths,
      };

      // task URL param is the fallback for standalone play without a stored variantId;
      // variantParams.task is authoritative when the variant carries it explicitly.
      const roarApp = new RoarMultichoice({ task, ...variantParams }, userParams, null);
      roarApp.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
