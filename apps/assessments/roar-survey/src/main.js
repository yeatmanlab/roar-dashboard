import { createApp } from 'vue';
import './styles/standalone.css';
import App from './App.vue';

import { RoarAppkit, initializeFirebaseProject } from '@bdelab/roar-firekit';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { roarConfig } from '../serve/firebaseConfig';
import { getBucketUrl } from './constants/bucketBaseUrl';

export const surveyModelRef = { value: null };
export let firekit = null;

async function initAndMountApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const surveyFile = urlParams.get('survey') ?? 'survey';
  const taskIdParam = urlParams.get('taskId');
  const assessmentPid = urlParams.get('assessmentPid');

  if (surveyFile) {
    document.title = `ROAR - Survey ${surveyFile}`;
  }

  const bucketUrl = getBucketUrl();
  const surveyUrl = `${bucketUrl}${surveyFile}.json`;

  try {
    const response = await fetch(surveyUrl);
    if (!response.ok) throw new Error(`Survey fetch failed: ${response.statusText}`);
    const surveyJson = await response.json();
    surveyModelRef.value = surveyJson;

    const appKit = await initializeFirebaseProject(roarConfig.firebaseConfig, 'assessmentApp', 'none');
    const taskId = taskIdParam ? `roar-survey-${taskIdParam}` : 'roar-survey';

    await signInAnonymously(appKit.auth);

    await new Promise((resolve) => {
      onAuthStateChanged(appKit.auth, (user) => {
        if (user) {
          firekit = new RoarAppkit({
            firebaseProject: appKit,
            taskInfo: {
              taskId,
              variantParams: { survey: surveyFile },
            },
            userInfo: {
              assessmentPid,
              assessmentUid: user.uid,
              userMetadata: { districtId: '' },
            },
          });

          firekit.startRun();
          resolve();
        }
      });
    });
    createApp(App, { surveyData: surveyModelRef.value }).mount('#app');
  } catch (err) {
    console.error('Error initializing survey app:', err);
    surveyModelRef.value = null;
    createApp(App).mount('#app');
  }
}

initAndMountApp();
