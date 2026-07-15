import { initializeApp } from 'firebase/app'; //firebase app initialization
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth'; //firebase authorization
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { mountVariantPicker } from '../../shared/variantPicker.js';

// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime'; //for async

const queryString = new URL(window.location).search; //returns a dictionary with various parameters of the URL or the "query string"
const urlParams = new URLSearchParams(queryString); //restructures the dictionary for accessing the key-value pairs

// Participant / session
const assessmentPid = urlParams.get('PROLIFIC_PID') || urlParams.get('participant'); //will get if it's prolific study
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Task selection: variantId wins; otherwise taskId resolves to the first published variant for that task.
const taskId = urlParams.get('task') ?? 'fluency-arf';

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
      // The variantId URL param wins; otherwise falls back to the first published variant for taskId.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        // eslint-disable-next-line no-undef
        { baseUrl, auth: authCallbacks },
        { ...(variantId ? { variantId } : {}), taskId },
      );

      const ctx = {
        // eslint-disable-next-line no-undef
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
      const { variantParams, taskId: resolvedTaskId } = await getVariantById(resolvedVariantId);

      // Dev/staging only: mount a variant switcher so reviewers can hop between
      // published variants without hand-editing the URL. No-op in production (the
      // guard is eliminated at build). Uses the resolved variant's taskId so it lists
      // the correct family even when only ?variantId= was provided — roam serves
      // fluency-arf, fluency-calf, and roam-alpaca.
      // eslint-disable-next-line no-undef
      if (ROAR_DB !== 'production') {
        mountVariantPicker({
          // eslint-disable-next-line no-undef
          baseUrl,
          auth: authCallbacks,
          taskId: resolvedTaskId,
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
