import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import i18next from 'i18next';
import RoarABC from '../src/experiment/index';
import { roarConfig } from './firebaseConfig';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const recruitment = urlParams.get('recruitment');
const userMode = urlParams.get('mode');
const assessmentPid = urlParams.get('PROLIFIC_PID') || urlParams.get('participant');
export const labId = urlParams.get('labId');
const audioFeedback = urlParams.get('feedback');

const skipInstructions = urlParams.get('skip')?.toLocaleLowerCase() === 'true';
const consent = urlParams.get('consent')?.toLocaleLowerCase() !== 'false';
const story = urlParams.get('story')?.toLocaleLowerCase() === 'true';
const task = urlParams.get('task') ?? 'letter';
const grade = urlParams.get('grade');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const ageMonths = urlParams.get('agemonths');
const age = urlParams.get('age');

const maxTime = urlParams.get('maxTime') === null ? null : parseInt(urlParams.get('maxTime'), 10); // time limit for real trials
const phonicsCorpus = urlParams.get('phonicsCorpus') ?? 'roar-phonics-2025-08-01-v3.csv';
const phonicsSet = urlParams.get('phonicsSet') ?? 'all';

// Not using these in other apps, remove them?
const schoolId = urlParams.get('schoolId');
const studyId = urlParams.get('studyId');
const classId = urlParams.get('classId');

// Use for Clowder
const itemSelectMethod = urlParams.get('itemSelect') ?? 'mfi';
const nItemsBeforeBreak =
  urlParams.get('nItemsBeforeBreak') === null ? null : parseInt(urlParams.get('nItemsBeforeBreak'), 10);
const nItemsBeforeBreakPhoneme =
  urlParams.get('nItemsBeforeBreakPhoneme') === null ? null : parseInt(urlParams.get('nItemsBeforeBreakPhoneme'), 10);
const earlyStopping = urlParams.get('earlyStopping')?.toLocaleLowerCase() ?? null;
const nItems = urlParams.get('nItems') === null ? null : parseInt(urlParams.get('nItems'), 10);
const nItemsPhoneme = urlParams.get('nItemsPhoneme') === null ? null : parseInt(urlParams.get('nItemsPhoneme'), 10);
const threshold = urlParams.get('threshold') ?? null;
const patience = urlParams.get('patience') ?? null;
const tolerance = urlParams.get('tolerance') ?? null;
const logicalOperation = urlParams.get('logicalOperation')?.toLocaleLowerCase() ?? 'only';
const randomSeed = urlParams.get('random') ?? null;
const catsToUpdate = urlParams.get('catsToUpdate')?.split(',') ?? [];
const minTheta = urlParams.get('minTheta') === null ? null : parseInt(urlParams.get('minTheta'), 10);
const maxTheta = urlParams.get('maxTheta') === null ? null : parseInt(urlParams.get('maxTheta'), 10);
const initialTheta = urlParams.get('initialTheta') === null ? null : parseInt(urlParams.get('initialTheta'), 10);
const method = urlParams.get('method') ?? 'eap';
const nStartItems = urlParams.get('nStartItems') === null ? null : parseInt(urlParams.get('nStartItems'), 10);
const startSelectMethod = urlParams.get('startSelectMethod') ?? 'random';
const scoringVersion = urlParams.get('scoringVersion') === null ? null : parseInt(urlParams.get('scoringVersion'), 10);
const { language } = i18next;

// @ts-ignore
const appKit = await initializeFirebaseProject(roarConfig.firebaseConfig, 'assessmentApp', 'none');
const taskId = language === 'en' ? task : `${task}-${language}`;

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentPid,
      assessmentUid: user.uid,
      userMetadata: {
        classId,
        schoolId,
        districtId: '',
        studyId,
      },
    };

    const userParams = {
      grade,
      assessmentPid,
      labId,
      birthMonth,
      birthYear,
      age,
      ageMonths,
    };

    const gameParams = {
      userMode,
      skipInstructions,
      consent,
      audioFeedback,
      story,
      task,
      recruitment,
      maxTime,
      phonicsSet,
      phonicsCorpus,
      itemSelectMethod,
      nItemsBeforeBreak,
      nItemsBeforeBreakPhoneme,
      earlyStopping, // clowder starts
      nItems,
      nItemsPhoneme,
      threshold,
      patience,
      tolerance,
      logicalOperation,
      randomSeed,
      catsToUpdate,
      minTheta,
      maxTheta,
      initialTheta,
      method,
      nStartItems,
      startSelectMethod,
      scoringVersion,
      taskId,
    };

    const taskInfo = {
      taskId: taskId,
      variantParams: gameParams,
    };

    const firekit = new RoarAppkit({
      firebaseProject: appKit,
      taskInfo,
      userInfo,
    });

    const roarApp = new RoarABC(firekit, gameParams, userParams);

    roarApp.run();
  }
});

await signInAnonymously(appKit.auth);
