import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { ROAV_MP_TASK_ID, ROAV_RVP_TASK_ID } from '@roar-platform/assessment-schema/roav-apps';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig.js';
import { mountVariantPicker } from '../../shared/variantPicker.js';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Task selection: variantId wins; otherwise taskId resolves to the first published variant.
const taskId = urlParams.get('task') ?? 'roav-rvp';

// The dev variant picker lists every published variant across all ROAV apps tasks.
const PICKER_TASK_IDS = [ROAV_MP_TASK_ID, ROAV_RVP_TASK_ID];
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Participant / demographics
const assessmentPid = urlParams.get('PROLIFIC_PID') || urlParams.get('participant');
const grade = urlParams.get('grade');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');

// Game params (corpusName, modeGame, modeSeq, dotlife, nameConfigStim, nameConfigBlock,
// recruitment, …) come exclusively from the seeded task-variant parameters — the run is
// linked to a variantId, so its params must match the variant. To run different params,
// seed another variant (taskVariantParameters.json) and select it with ?variantId. Only the
// dev locale override stays on the URL; roav-apps ships en/es/it.
const languageOverride = urlParams.get('lng');

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

      // Provision the anonymous ROAR user and resolve a variant via the SDK.
      // variantId wins; otherwise falls back to the first published variant for taskId.
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
          taskId: PICKER_TASK_IDS,
          currentVariantId: resolvedVariantId,
        });
      }

      const { variantParams } = await getVariantById(resolvedVariantId);

      // Game params come entirely from the seeded variant — the run is linked to its
      // variantId, so what was presented must match what the variant declares.
      // Load-bearing: every seeded roav-apps variant's params MUST include `taskName` —
      // TaskLauncher (src/index.js) reads it off gameParams to route to
      // taskConfig[camelize(taskName)]. getVariantById round-trips the seeded params verbatim,
      // so a variant missing taskName would fail task resolution here.
      const gameParams = { ...variantParams };

      // User/participant params come from the launch URL. The dev locale override is a
      // per-participant concern and is layered here; it wins over any variant `language`
      // because initConfig merges userParams after gameParams.
      const userParams = {
        assessmentPid,
        grade,
        birthMonth,
        birthYear,
        age,
        ageMonths,
        ...(languageOverride ? { language: languageOverride } : {}),
      };

      const task = new TaskLauncher(gameParams, userParams);
      task.run();
    } catch (err) {
      console.error('[roav-apps] Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
