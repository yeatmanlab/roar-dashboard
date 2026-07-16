import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { RAN_TASK_ID, SYMBOL_SEARCH_TASK_ID } from '@roar-platform/assessment-schema/roav-ran';
import TaskLauncher from '../src/experiment/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig.js';
import { mountVariantPicker } from '../../shared/variantPicker.js';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Task selection: variantId wins; otherwise taskId resolves to the first published variant.
// roav-ran is English-only, so the task slug is used directly (no language suffix).
const taskId = urlParams.get('task') ?? 'ran';

// The dev variant picker lists every published variant across all roav-ran tasks.
const PICKER_TASK_IDS = [RAN_TASK_ID, SYMBOL_SEARCH_TASK_ID];
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Participant context from the launch URL. The operator-entered PID goes to run metadata and
// the recording path — never the user record.
const assessmentPid = urlParams.get('participant') ?? '';
const grade = urlParams.get('grade');
const age = urlParams.get('age');
const birthMonth = urlParams.get('birthmonth');
const birthYear = urlParams.get('birthyear');
const ageMonths = urlParams.get('agemonths');
// Dev-only locale override; roav-ran ships English only (i18next defaults to en).
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

      // Variant-authoritative: game params come entirely from the seeded variant. Its params
      // include `taskName`, which TaskLauncher reads to route to taskConfig[camelize(taskName)],
      // so a variant missing taskName would fail task resolution.
      const gameParams = { ...variantParams };

      // Participant params from the launch URL. The dev locale override is layered here and
      // wins over any variant `language` because initConfig merges userParams after gameParams.
      const userParams = {
        assessmentPid,
        grade,
        age,
        birthMonth,
        birthYear,
        ageMonths,
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
