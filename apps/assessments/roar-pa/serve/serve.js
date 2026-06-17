import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { bootstrapAnonymousSession } from '@roar-platform/assessment-sdk';
import { pa } from '@roar-platform/assessment-schema';
import RoarPA from '../src/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { wireScoreAdapter } from '../src/sdk/pa-firekit-facade';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const { PA_SCORING_VERSION } = pa;

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
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';
// Boolean parameters
const consent = urlParams.get('consent') !== 'false';
const storyOption = urlParams.get('storyoption');
const story = urlParams.get('story') ? urlParams.get('story').toLocaleLowerCase() !== 'false' : null;
const skipInstructions = urlParams.get('skip') !== 'false';

const firebaseConfig = await getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// eslint-disable-next-line no-undef
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // eslint-disable-next-line no-undef
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
}

const earlyStopping = urlParams.get('earlyStopping')?.toLocaleLowerCase() ?? null;
const threshold = urlParams.get('threshold') ?? null;
const patience = urlParams.get('patience') ?? null;
const tolerance = urlParams.get('tolerance') ?? null;
const logicalOperation = urlParams.get('logicalOperation')?.toLocaleLowerCase() ?? null;
const randomSeed = urlParams.get('random') ?? null;
const isAdaptive = urlParams.get('isAdaptive') === 'true';
const itemSelect = urlParams.get('itemSelect') ?? 'fixed';
const abilityMethod = urlParams.get('abilityMethod')?.toLocaleLowerCase() ?? 'eap';
const scoringVersionParams = parseInt(urlParams.get('scoringVersion') ?? PA_SCORING_VERSION.V5_ADAPTIVE, 10);
const scoringVersion = Number.isNaN(scoringVersionParams) ? PA_SCORING_VERSION.V5_ADAPTIVE : scoringVersionParams;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const auth = { getToken: () => user.getIdToken() };

      // Provision the anonymous ROAR user (and resolve a variant) via the SDK. This replaces
      // the previous raw-fetch workaround: the SDK requires a participantId to initialize, yet
      // POST /users/anonymous is what provisions that id, so bootstrapAnonymousSession performs
      // the participant-free calls and hands back the participantId and resolved variantId.
      // The variantId URL param wins; otherwise it falls back to the first published variant.
      const { participantId, variantId: resolvedVariantId } = await bootstrapAnonymousSession(
        // eslint-disable-next-line no-undef
        { baseUrl: ROAR_API_BASE_URL, auth },
        { ...(variantId ? { variantId } : {}), taskId: pa.PA_TASK_ID },
      );

      const ctx = {
        // eslint-disable-next-line no-undef
        baseUrl: ROAR_API_BASE_URL,
        auth,
        participant: { participantId },
      };

      initFirekitCompat(ctx, {
        variantId: resolvedVariantId,
        taskVersion,
        isAnonymous: true,
      });

      // Wire PA score computation pipeline
      wireScoreAdapter();

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
        scoringVersion,
      };

      const roarApp = new RoarPA(gameParams, userParams);
      roarApp.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
