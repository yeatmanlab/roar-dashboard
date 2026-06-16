import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import i18next from 'i18next';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';
import { roarConfig } from './firebaseConfig';
import RoarSRE from '../src/index';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);
const assessmentPid = urlParams.get('participant');
const labId = urlParams.get('labId');
const userMode = urlParams.get('mode');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');
const recruitment = urlParams.get('recruitment');
const storyOption = urlParams.get('storyoption');
const grade = urlParams.get('grade');
const timerLength = Number.isNaN(parseInt(urlParams.get('timerLength'), 10))
  ? 180000
  : parseInt(urlParams.get('timerLength'), 10);
const { language } = i18next;

/* 4 modes
default: no-survey + story (if < grade 6) and no-story (if >= grade 6)
demo: survey + story all grades
story: no-survey + story all grades
nostory: no-survey + no-story all grades
 */
const skipInstructions = urlParams.get('skip') !== 'false';
const consent = urlParams.get('consent') !== 'false';
// Validation
// If useParameterValidation is true, the experiment will throw an error if any of the parameters do not conform to their expected values
const useParameterValidation = urlParams.get('useParameterValidation') === 'true';
// Scoring version (v3 or v4 for sre, v1 for sre-es)
const defaultScoringVersion = language === 'es' ? 1 : 3;
const scoringVersionParam = parseInt(urlParams.get('scoringVersion'), 10);
const scoringVersion = Number.isNaN(scoringVersionParam) ? defaultScoringVersion : scoringVersionParam;

// @ts-ignore
const appKit = await initializeFirebaseProject(roarConfig.firebaseConfig, 'assessmentApp', 'none');
const taskId = language === 'en' ? 'sre' : `sre-${language}`;

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentPid,
      assessmentUid: user.uid,
      userMetadata: {},
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
      scoringVersion,
      storyOption,
      timerLength,
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

    const roarApp = new RoarSRE(firekit, gameParams, userParams, null, useParameterValidation);

    roarApp.run();
  }
});

await signInAnonymously(appKit.auth);
