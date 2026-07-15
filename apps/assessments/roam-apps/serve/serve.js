import { initializeApp } from 'firebase/app'; //firebase app initialization
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth'; //firebase authorization
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { resolveRoamTaskId } from '@roar-platform/assessment-schema/roam-apps';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import i18next from 'i18next'; //has info on language?
import { convertStrToBool } from '../src/tasks/shared/helpers';

// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime'; //for async

const queryString = new URL(window.location).search; //returns a dictionary with various parameters of the URL or the "query string"
const urlParams = new URLSearchParams(queryString); //restructures the dictionary for accessing the key-value pairs
const userMode = urlParams.get('mode');
const recruitment = urlParams.get('recruitment'); //will get if its otherLabs
const responseMode = urlParams.get('responseMode');
const taskName = urlParams.get('task') ?? 'fluency-arf';
const storyOption = convertStrToBool(urlParams.get('storyOption'));
const keyboardPractice = convertStrToBool(urlParams.get('keyboardPractice'));
const audio = convertStrToBool(urlParams.get('audio'));
const corpusName = urlParams.get('corpusName');

//const taskId = language === "en" ? "fluency" : `fluency-${language}`;

// Backend run/variant resolution
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

const assessmentPid = urlParams.get('PROLIFIC_PID') || urlParams.get('participant'); //will get if it's prolific study
const labId = urlParams.get('labId');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');
const grade = urlParams.get('grade'); //for number Lab prolific study

// Boolean parameters
const consent = convertStrToBool(urlParams.get('consent'));
const { language } = i18next;

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

      // taskName/language map to the backend task ID the same way the URL params
      // (task, lng) always have — resolveRoamTaskId mirrors the old inline
      // `taskName + '-' + language` logic, but against the verified task ID table.
      const taskId = resolveRoamTaskId(taskName, language);

      // Provision the anonymous ROAR user (and resolve a variant) via the SDK.
      // The variantId URL param wins; otherwise it falls back to the first published variant.
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

      const userParams = {
        assessmentPid,
        grade,
        birthMonth,
        birthYear,
        age,
        ageMonths,
      };

      const gameParams = {
        userMode,
        recruitment,
        labId,
        consent,
        responseMode,
        taskName,
        storyOption,
        keyboardPractice,
        audio,
        corpusName,
      };

      const task = new TaskLauncher(gameParams, userParams);
      task.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

//signs in the user anonymously so a ROAR run can be provisioned and written to
await signInAnonymously(auth);
