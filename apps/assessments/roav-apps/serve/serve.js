import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit'; // firekit functions
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'; // firebase authorization
import i18next from 'i18next';
import { TaskLauncher } from '../src';
// eslint-disable-next-line import/no-unresolved -- PR3 (SDK wiring) replaces this with the shared Firebase config; the local firebaseConfig.js was deleted as a sensitive file in PR1.
import { roarConfig } from './firebaseConfig'; // firebase configuration details

// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime'; // for async

// const convertStrToBool = (str) => (str ? str === "true" : str);
const convertStrToNumber = (str) => {
  if (str === null || str === undefined || str.trim() === '') return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
};

const queryString = new URL(window.location).search; // returns a dictionary with various parameters of the URL or the "query string"
const urlParams = new URLSearchParams(queryString); // restructures the dictionary for accessing the key-value pairs
const taskName = urlParams.get('task') ?? 'roav-rvp';
const corpusName = urlParams.get('corpusName');
const recruitment = urlParams.get('recruitment');
// const audio = convertStrToBool(urlParams.get("audio"));

const assessmentPid = urlParams.get('PROLIFIC_PID') || urlParams.get('participant');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');
const grade = urlParams.get('grade');

const modeSeq = urlParams.get('modeSeq'); // "fixed" | "random" - sequence of trials                    // "random" or "fixed" - sequence of studies

const modeGame = urlParams.get('modeGame'); // "game" | "stand" | "all"

// Specific to ROAV-MP
const dotlife = convertStrToNumber(urlParams.get('dotlife'));

const nameConfigStim = urlParams.get('nameConfigStim');
const nameConfigBlock = urlParams.get('nameConfigBlock');

const { language } = i18next;

// This function is part of bde-lab firekit package, it requires the firebase configuration details, name, authPersistence
// @ts-ignore
const appKit = await initializeFirebaseProject(roarConfig.firebaseConfig, 'assessmentApp', 'none');

let taskId = taskName;
if (language !== 'en') {
  taskId = `${taskId}-${language}`;
}

onAuthStateChanged(appKit.auth, (user) => {
  if (user) {
    const userInfo = {
      assessmentPid,
      assessmentUid: user.uid,
      userMetadata: {
        districtId: '',
      },
    };

    const userParams = {
      assessmentPid,
      grade,
      birthMonth,
      birthYear,
      age,
      ageMonths,
      // group,
    };

    let gameParams = {
      taskName,
      corpusName,
      modeGame,
      recruitment,
      // audio,
      // consent
    };

    if (taskName === 'roav-mp') {
      gameParams = {
        ...gameParams,
        modeSeq,
        dotlife,
      };
    } else if (taskName === 'roav-rvp') {
      gameParams = {
        ...gameParams,
        nameConfigStim,
        nameConfigBlock,
      };
    }

    const taskInfo = {
      taskId: taskId,
      variantParams: gameParams,
    };

    // generates a new roarApp class based on the roar firestore API
    const firekit = new RoarAppkit({
      firebaseProject: appKit,
      taskInfo,
      userInfo,
    });

    const task = new TaskLauncher(firekit, gameParams, userParams);
    task.run();
  }
});

// signs in the user based on the firebase credentials
// Ensures that data can be written to firebase
await signInAnonymously(appKit.auth);
