import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import {
  LEVANTE_NORMED_TASK_IDS,
  LEVANTE_PROVISIONAL_TASK_IDS,
} from '@roar-platform/assessment-schema/roar-levante-tasks';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig.js';
import { mountVariantPicker } from '../../shared/variantPicker.js';
import { ROAR_DB_MODE, unresolvedDefaultVariantPolicy } from '../../shared/roarDbMode.js';
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

// Task selection: variantId wins; otherwise taskId picks the task and DEFAULT_VARIANT_NAMES
// supplies its default variant name.
const taskId = urlParams.get('task') ?? 'egma-math';

// The dev variant picker lists every published variant across all LEVANTE tasks.
const PICKER_TASK_IDS = [...Object.values(LEVANTE_NORMED_TASK_IDS), ...Object.values(LEVANTE_PROVISIONAL_TASK_IDS)];

// Default variant per task, used when the URL supplies no `variantId`. Placeholder values
// lifted from taskVariantParameters.example.json — researchers revise these per environment
// as they re-create the variants. A task with no entry keeps the previous behaviour (oldest
// published variant). See https://github.com/yeatmanlab/roar-project-management/issues/1828
const DEFAULT_VARIANT_NAMES = {
  [LEVANTE_NORMED_TASK_IDS.TROG]: 'roar-syntax-2026-05-14-v4',
  [LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE]: 'inference-school-2025-04-01-10min-1perstory-v7',
  [LEVANTE_PROVISIONAL_TASK_IDS.EGMA_MATH]: 'Egma-Math-Default',
  [LEVANTE_PROVISIONAL_TASK_IDS.MATRIX_REASONING]: 'Matrix-Reasoning-Default',
  [LEVANTE_PROVISIONAL_TASK_IDS.MENTAL_ROTATION]: 'Mental-Rotation-Default',
  [LEVANTE_PROVISIONAL_TASK_IDS.SAME_DIFFERENT_SELECTION]: 'Same-Different-Selection-Default',
  [LEVANTE_PROVISIONAL_TASK_IDS.THEORY_OF_MIND]: 'Theory-of-Mind-Default',
  // hearts-and-flowers, memory-game, vocab and intro have no constants in
  // @roar-platform/assessment-schema, so they are left to the fallback for now.
};

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
          taskId: PICKER_TASK_IDS,
          currentVariantId: resolvedVariantId,
        });
      }

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

      const isDev = ROAR_DB === 'development';
      const task = new TaskLauncher(variantParams, userParams, isDev);
      task.run();
    } catch (err) {
      console.error('[roar-levante-tasks] Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
