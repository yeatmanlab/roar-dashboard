import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { pa } from '@roar-platform/assessment-schema';
import RoarPA from '../src/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { mountVariantPicker } from '../../shared/variantPicker.js';
import { ROAR_DB_MODE, unresolvedDefaultVariantPolicy } from '../../shared/roarDbMode.js';
import { wireScoreAdapter } from '../src/sdk/pa-firekit-facade';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Variant / session
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Default variant per task, used when the URL supplies no `variantId`. Placeholder values
// lifted from taskVariantParameters.example.json — researchers revise these per environment
// as they re-create the variants. A task with no entry keeps the previous behaviour (oldest
// published variant). See https://github.com/yeatmanlab/roar-project-management/issues/1828
const DEFAULT_VARIANT_NAMES = {
  [pa.PA_TASK_ID]: 'English Fixed (v3)',
};

// User / participant params — game configuration comes from variant params fetched via SDK
const assessmentPid = urlParams.get('participant');
const labId = urlParams.get('labId');
const grade = urlParams.get('grade');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');

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
      // Performs the participant-free calls and hands back the participantId and resolved variantId.
      // The variantId URL param wins; otherwise the task's entry in DEFAULT_VARIANT_NAMES is
      // matched by name, falling back to the oldest published variant when there is none.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        { baseUrl, auth: authCallbacks },
        {
          ...(variantId ? { variantId } : {}),
          taskId: pa.PA_TASK_ID,
          defaultVariantName: DEFAULT_VARIANT_NAMES[pa.PA_TASK_ID],
          onUnresolvedDefault: unresolvedDefaultVariantPolicy(ROAR_DB),
        },
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
      if (ROAR_DB !== ROAR_DB_MODE.PRODUCTION) {
        mountVariantPicker({
          baseUrl,
          auth: authCallbacks,
          taskId: pa.PA_TASK_ID,
          currentVariantId: resolvedVariantId,
        });
      }

      // Wire PA score computation pipeline
      wireScoreAdapter();

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

      const roarApp = new RoarPA(variantParams, userParams);
      roarApp.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
