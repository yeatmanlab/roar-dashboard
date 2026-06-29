import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { TaskLauncher } from '../src';
import { getFirebaseConfig } from '../../shared/firebaseConfig.js';
import { stringToBoolean } from '../src/tasks/shared/helpers';
import i18next from 'i18next';
// Import necessary in order to use async/await at the top level
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const taskName = urlParams.get('task') ?? 'egma-math';
const corpus = urlParams.get('corpus');
const buttonLayout = urlParams.get('buttonLayout');
const numOfPracticeTrials = urlParams.get('practiceTrials');
const numberOfTrials = urlParams.get('trials') === null ? null : parseInt(urlParams.get('trials'), 10);
const maxIncorrect = urlParams.get('maxIncorrect') === null ? null : parseInt(urlParams.get('maxIncorrect'), 10);
const stimulusBlocks = urlParams.get('blocks') === null ? null : parseInt(urlParams.get('blocks'), 10);
const age = urlParams.get('age') === null ? null : parseInt(urlParams.get('age'), 10);
const maxTime = urlParams.get('maxTime') === null ? null : parseInt(urlParams.get('maxTime'), 10);
const language = urlParams.get('lng');
const pid = urlParams.get('pid');
const inferenceNumStories =
  urlParams.get('inferenceNumStories') === null ? null : parseInt(urlParams.get('inferenceNumStories'), 10);
const numberOfStories = urlParams.get('numberOfStories') === null ? 3 : parseInt(urlParams.get('numberOfStories'), 10);
const semThreshold = Number(urlParams.get('semThreshold') || '0');
const startingTheta = Number(urlParams.get('theta') || '0');
// `taskVersion` is deprecated; prefer `version` when both are present.
const versionFromQuery = urlParams.get('version') === null ? null : parseInt(urlParams.get('version'), 10);
const taskVersionFromQuery = urlParams.get('taskVersion') === null ? null : parseInt(urlParams.get('taskVersion'), 10);
const version = versionFromQuery ?? taskVersionFromQuery;
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// Boolean parameters
const keyHelpers = stringToBoolean(urlParams.get('keyHelpers'));
const skipInstructions = stringToBoolean(urlParams.get('skip'), true);
const sequentialPractice = stringToBoolean(urlParams.get('sequentialPractice'), true);
const sequentialStimulus = stringToBoolean(urlParams.get('sequentialStimulus'), true);
const storeItemId = stringToBoolean(urlParams.get('storeItemId'), false);
const cat = stringToBoolean(urlParams.get('cat'), false);
const heavyInstructions = stringToBoolean(urlParams.get('heavyInstructions'), false);
const storyOption = urlParams.get('storyOption') ?? '';
const grade = urlParams.get('grade') ?? '';
const demoMode = false;
const experimenterButtons = stringToBoolean(urlParams.get('experimenterButtons'), false);
const debug = stringToBoolean(urlParams.get('debug'), false);
const scoringVersion = urlParams.get('scoringVersion') === null ? null : parseInt(urlParams.get('scoringVersion'), 10);
const randomSeed = urlParams.get('randomSeed');

const firebaseConfig = await getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// eslint-disable-next-line no-undef
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // eslint-disable-next-line no-undef
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const authCallbacks = { getToken: () => user.getIdToken() };

      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        // eslint-disable-next-line no-undef
        { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks },
        { ...(variantId ? { variantId } : {}), taskId: taskName },
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

      // URL params override variant params to allow standalone testing of specific conditions.
      const gameParams = {
        ...variantParams,
        taskName: variantParams.taskName ?? taskName,
        skipInstructions,
        sequentialPractice,
        sequentialStimulus,
        ...(corpus != null && { corpus }),
        ...(buttonLayout != null && { buttonLayout }),
        ...(numOfPracticeTrials != null && { numOfPracticeTrials }),
        ...(numberOfTrials != null && { numberOfTrials }),
        ...(maxIncorrect != null && { maxIncorrect }),
        ...(stimulusBlocks != null && { stimulusBlocks }),
        keyHelpers,
        language: language ?? variantParams.language ?? i18next.language,
        ...(maxTime != null && { maxTime }),
        storeItemId,
        cat,
        ...(inferenceNumStories != null && { inferenceNumStories }),
        numberOfStories,
        semThreshold,
        startingTheta,
        heavyInstructions,
        storyOption,
        demoMode,
        ...(version != null && { version }),
        debug,
        experimenterButtons,
        ...(scoringVersion != null && { scoringVersion }),
        ...(randomSeed != null && { randomSeed }),
      };

      const userParams = {
        pid,
        grade,
        age,
      };

      // eslint-disable-next-line no-undef
      const isDev = ROAR_DB === 'development';
      const task = new TaskLauncher(gameParams, userParams, isDev);
      task.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
