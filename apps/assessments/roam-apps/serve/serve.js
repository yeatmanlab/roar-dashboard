import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit'; //firekit functions
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'; //firebase authorization
import { TaskLauncher } from '../src';
// eslint-disable-next-line import/no-unresolved -- handled in PR 2
import { roarConfig } from './firebaseConfig'; //firebase configuration details
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
/*let group = parseInt(urlParams.get("group")); // for prolific study
if (isNaN(group)) {
  group = randomInteger(1, 8);
}*/
//const study = urlParams.get("study"); // for prolific study

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

// This function is part of bde-lab firekit package, it requires the firebase configuration details, name, authPersistence
// @ts-ignore
const appKit = await initializeFirebaseProject(roarConfig.firebaseConfig, 'assessmentApp', 'none');

//const taskId = language === "en" ? "fluency" : `fluency-${language}`;

let taskId = taskName;
if (language !== 'en') {
  taskId = taskId + '-' + language;
}

//adds an observes for changes in the user's sign-in state.
//This seems to start the task when the firebase project has been initialised and the user is signed in.
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
      //group,
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

    const taskInfo = {
      taskId: taskId,
      variantParams: gameParams,
    };

    //generates a new roarApp class based on the roar firestore API
    const firekit = new RoarAppkit({
      firebaseProject: appKit,
      taskInfo,
      userInfo,
    });

    const task = new TaskLauncher(firekit, gameParams, userParams);
    task.run();
  }
});

//signs in the user based on the firebase credentials
//Ensures that data can be written to firebase
await signInAnonymously(appKit.auth);
