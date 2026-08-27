import { initializeApp } from 'firebase/app'; //firebase app initialization
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth'; //firebase authorization
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { mountVariantPicker } from '../../shared/variantPicker.js';
import { ROAR_DB_MODE, unresolvedDefaultVariantPolicy } from '../../shared/roarDbMode.js';
import {
  ROAM_FLUENCY_ARF_TASK_IDS,
  ROAM_FLUENCY_CALF_TASK_IDS,
  ROAM_ALPACA_TASK_IDS,
} from '@roar-platform/assessment-schema/roam-apps';

// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime'; //for async

const queryString = new URL(window.location).search; //returns a dictionary with various parameters of the URL or the "query string"
const urlParams = new URLSearchParams(queryString); //restructures the dictionary for accessing the key-value pairs

// Participant / session
const assessmentPid = urlParams.get('PROLIFIC_PID') || urlParams.get('participant'); //will get if it's prolific study
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Task selection: variantId wins; otherwise taskId picks the task and DEFAULT_VARIANT_NAMES
// supplies its default variant name.
const taskId = urlParams.get('task') ?? 'fluency-arf';

// All roam backend task slugs (language-suffixed). roam's tasks each hold only a few
// variants, so the dev variant picker lists across all of them to surface every seeded
// variant. Un-seeded slugs (e.g. a locale that wasn't seeded) are skipped by the picker.

// Default variant per task, used when the URL supplies no `variantId`. Placeholder values
// lifted from taskVariantParameters.example.json — researchers revise these per environment
// as they re-create the variants. A task with no entry keeps the previous behaviour (oldest
// published variant). See https://github.com/yeatmanlab/roar-project-management/issues/1828
const DEFAULT_VARIANT_NAMES = {
  [ROAM_FLUENCY_ARF_TASK_IDS.EN]: 'math-facts-2afc-school',
  [ROAM_FLUENCY_ARF_TASK_IDS.ES]: 'un-digito-school-nostory-keyboardPractice',
  [ROAM_FLUENCY_ARF_TASK_IDS.PT]: 'pt-um-digito-school-nostory-keyboardPractice',
  [ROAM_FLUENCY_CALF_TASK_IDS.EN]: 'calculation-fluency-6afc-school-v0226',
  [ROAM_FLUENCY_CALF_TASK_IDS.ES]: 'varios-digitos-school-nostory-keyboardPractice',
  [ROAM_FLUENCY_CALF_TASK_IDS.PT]: 'pt-varios-digitos-school-nostory-keyboardPractice',
  [ROAM_ALPACA_TASK_IDS.EN]: 'core-math-school-v0825',
  [ROAM_ALPACA_TASK_IDS.PT]: 'pt-core-math-school-v0825',
};
const ROAM_TASK_IDS = [
  ...Object.values(ROAM_FLUENCY_ARF_TASK_IDS),
  ...Object.values(ROAM_FLUENCY_CALF_TASK_IDS),
  ...Object.values(ROAM_ALPACA_TASK_IDS),
];

// Demographics
const grade = urlParams.get('grade'); //for number Lab prolific study
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
      // The variantId URL param wins; otherwise the task's entry in DEFAULT_VARIANT_NAMES is
      // matched by name, falling back to the oldest published variant when there is none.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        { baseUrl, auth: authCallbacks },
        {
          ...(variantId ? { variantId } : {}),
          taskId,
          defaultVariantName: DEFAULT_VARIANT_NAMES[taskId],
          onUnresolvedDefault: unresolvedDefaultVariantPolicy(ROAR_DB),
        },
      );

      const ctx = {
        baseUrl,
        auth: authCallbacks,
        participant: { participantId },
        // Without this, computedScoreCallback failures inside writeTrial are
        // caught and silently dropped — the trial still writes, but with no
        // scores and no visible error. See firekit.ts's writeTrial catch block.
        logger: console,
      };

      initFirekitCompat(ctx, {
        variantId: resolvedVariantId,
        taskVersion,
        isAnonymous: true,
      });

      // Game parameters (taskName, language, responseMode, corpusName, userMode,
      // labId, consent, storyOption, keyboardPractice, audio, recruitment) come
      // from the resolved variant — not URL params. See
      // taskVariantParameters.example.json for the shape. initConfig merges these
      // over userParams, reads `language`, and drives i18next.changeLanguage.
      const { variantParams } = await getVariantById(resolvedVariantId);

      // Dev/staging only: mount a variant switcher so reviewers can hop between
      // published variants without hand-editing the URL. No-op in production (the
      // guard is eliminated at build). roam's tasks are language-suffixed and hold
      // only a few variants each, so the picker lists across all roam task slugs to
      // surface every seeded variant; selecting one reloads with its ?variantId=.
      if (ROAR_DB !== ROAR_DB_MODE.PRODUCTION) {
        mountVariantPicker({
          baseUrl,
          auth: authCallbacks,
          taskId: ROAM_TASK_IDS,
          currentVariantId: resolvedVariantId,
        });
      }

      const userParams = {
        assessmentPid,
        grade,
        birthMonth,
        birthYear,
        age,
        ageMonths,
      };

      const task = new TaskLauncher(variantParams, userParams);
      task.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

//signs in the user anonymously so a ROAR run can be provisioned and written to
await signInAnonymously(auth);
