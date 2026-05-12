import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import i18next from 'i18next';
import RoarPA from '../src/index';
import { roarConfig } from './firebaseConfig';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const assessmentPid = urlParams.get('participant');
const labId = urlParams.get('labId');
const recruitment = urlParams.get('recruitment');
const userMode = urlParams.get('mode');
const grade = urlParams.get('grade');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');
const numTestItems = urlParams.get('numtestitems') ? Number(urlParams.get('numtestitems')) : null;
// Boolean parameters
const consent = urlParams.get('consent') !== 'false';
const storyOption = urlParams.get('storyoption');
const story = urlParams.get('story') ? urlParams.get('story').toLocaleLowerCase() !== 'false' : null;
const skipInstructions = urlParams.get('skip') !== 'false';
const { language } = i18next;
// @ts-ignore
const appKit = await initializeFirebaseProject(roarConfig.firebaseConfig, 'assessmentApp', 'none');
const taskId = language === 'en' ? 'pa' : `pa-${language}`;
const earlyStopping = urlParams.get('earlyStopping')?.toLocaleLowerCase() ?? null;
const threshold = urlParams.get('threshold') ?? null;
const patience = urlParams.get('patience') ?? null;
const tolerance = urlParams.get('tolerance') ?? null;
const logicalOperation = urlParams.get('logicalOperation')?.toLocaleLowerCase() ?? null;
const randomSeed = urlParams.get('random') ?? null;
const isAdaptive = urlParams.get('isAdaptive') === 'true';
const itemSelect = urlParams.get('itemSelect') ?? 'fixed';
const abilityMethod = urlParams.get('abilityMethod')?.toLocaleLowerCase() ?? 'eap';

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentPid,
      assessmentUid: user.uid,
      userMetadata: {
        districtId: '',
        language,
      },
    };

    const userParams = {
      assessmentPid,
      labId,
      grade,
      birthMonth,
      birthYear,
      age,
      ageMonths,
    };

    const gameParams = {
      userMode,
      recruitment,
      skipInstructions,
      consent,
      story,
      storyOption,
      numTestItems,
      earlyStopping,
      threshold,
      patience,
      tolerance,
      logicalOperation,
      randomSeed,
      isAdaptive,
      itemSelect,
      abilityMethod,
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

    const roarApp = new RoarPA(firekit, gameParams, userParams);

    roarApp.run();
  }
});

await signInAnonymously(appKit.auth);
