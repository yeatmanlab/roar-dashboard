import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { TaskLauncher } from '../src';
import firebaseConfig from './firebaseConfig';
import { stringToBoolean } from '../src/tasks/shared/helpers';
import i18next from 'i18next';
// Import necessary in order to use async/await at the top level
import 'regenerator-runtime/runtime';

// TODO: Add game params for all tasks
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
const maxTime = urlParams.get('maxTime') === null ? null : parseInt(urlParams.get('maxTime'), 10); // time limit for real trials
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
// ROAR only
const scoringVersion = urlParams.get('scoringVersion') === null ? null : parseInt(urlParams.get('scoringVersion'), 10);
const randomSeed = urlParams.get('randomSeed');

async function startWebApp() {
  const appKit = await initializeFirebaseProject(firebaseConfig, 'assessmentApp', 'none');

  onAuthStateChanged(appKit.auth, (user) => {
    if (user) {
      const userInfo = {
        assessmentUid: user.uid,
        userMetadata: {},
      };

      const userParams = {
        pid,
        grade,
        age,
      };

      const gameParams = {
        taskName,
        skipInstructions,
        sequentialPractice,
        sequentialStimulus,
        corpus,
        buttonLayout,
        numOfPracticeTrials,
        numberOfTrials,
        maxIncorrect,
        stimulusBlocks,
        keyHelpers,
        language: language ?? i18next.language,
        maxTime,
        storeItemId,
        cat,
        inferenceNumStories,
        numberOfStories,
        semThreshold,
        startingTheta,
        heavyInstructions,
        storyOption,
        demoMode,
        version,
        debug,
        experimenterButtons,
        scoringVersion,
        randomSeed,
      };

      const taskInfo = {
        taskId: taskName,
        variantParams: gameParams,
      };

      const firekit = new RoarAppkit({
        firebaseProject: appKit,
        taskInfo,
        userInfo,
      });

      const task = new TaskLauncher(firekit, gameParams, userParams);
      task.run();
    }
  });

  await signInAnonymously(appKit.auth);
}

await startWebApp();
