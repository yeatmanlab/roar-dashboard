import { createApp } from 'vue';
import './styles/standalone.css';
import App from './App.vue';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { getBucketUrl } from './constants/bucketBaseUrl';
import 'regenerator-runtime/runtime';

async function initAndMountApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const surveyFile = urlParams.get('survey') ?? 'survey';
  const taskIdParam = urlParams.get('taskId');
  const taskVersion = urlParams.get('taskVersion') ?? '1.0';
  const taskId = taskIdParam ? `roar-survey-${taskIdParam}` : 'roar-survey';

  if (surveyFile) document.title = `ROAR - Survey ${surveyFile}`;

  let surveyJson = null;
  try {
    const response = await fetch(`${getBucketUrl()}${surveyFile}.json`);
    if (!response.ok) throw new Error(`Survey fetch failed: ${response.statusText}`);
    surveyJson = await response.json();
  } catch (err) {
    console.error('Error fetching survey:', err);
  }

  const firebaseConfig = await getFirebaseConfig();
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
      disableWarnings: true,
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const authCallbacks = { getToken: () => user.getIdToken() };

        const { participantId, variantId } = await bootstrapAnonymousSession(
          { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks },
          { taskId },
        );

        initFirekitCompat(
          { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks, participant: { participantId } },
          { variantId, taskVersion, isAnonymous: true },
        );

        createApp(App, { surveyData: surveyJson }).mount('#app');
      } catch (err) {
        console.error('Error initializing survey app:', err);
        createApp(App, { surveyData: surveyJson }).mount('#app');
      }
    }
  });

  await signInAnonymously(auth);
}

initAndMountApp();
