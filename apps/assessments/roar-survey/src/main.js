import { createApp } from 'vue';
import './styles/standalone.css';
import App from './App.vue';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import 'regenerator-runtime/runtime';

async function initAndMountApp() {
  const urlParams = new URLSearchParams(window.location.search);
  // Passed through to SurveyRunner as a fallback only — the variant names the content file,
  // and this URL param covers variants that predate the key.
  const surveyFile = urlParams.get('survey');
  const language = urlParams.get('lng') ?? 'en';
  const taskIdParam = urlParams.get('taskId');
  const taskVersion = urlParams.get('taskVersion') ?? '1.0';
  const taskId = taskIdParam ? `roar-survey-${taskIdParam}` : 'roar-survey';

  if (surveyFile) document.title = `ROAR - Survey ${surveyFile}`;

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

        const sdkContext = {
          ctx: { baseUrl: ROAR_API_BASE_URL, auth: authCallbacks, participant: { participantId } },
          taskInfo: { variantId, taskVersion, isAnonymous: true },
        };

        createApp(App, { sdkContext, language, surveyFile }).mount('#app');
      } catch (err) {
        console.error('Error initializing survey app:', err);
        // Mounted without a context so SurveyRunner shows its error state rather than a
        // blank page — it cannot resolve or fetch anything without a session.
        createApp(App, { language, surveyFile }).mount('#app');
      }
    }
  });

  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error('Failed to sign in anonymously:', err);
    // No session, so no context: SurveyRunner renders its error state rather than a blank page.
    createApp(App, { language, surveyFile }).mount('#app');
  }
}

initAndMountApp();
