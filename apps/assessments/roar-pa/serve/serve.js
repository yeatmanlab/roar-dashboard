import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { initFirekitCompat } from '@yeatmanlab/assessment-sdk/compat/firekit';
import { pa } from '@roar-dashboard/assessment-schema';
import RoarPA from '../src/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
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
const scoringVersionParams = parseInt(urlParams.get('scoringVersion') ?? 4, 10);
const scoringVersion = Number.isNaN(scoringVersionParams) ? 5 : scoringVersionParams;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const token = await user.getIdToken();

      // Raw fetch is intentional here: the SDK requires a participantId (ROAR UUID) to
      // initialize, but this call is what provisions that UUID. The SDK can't bootstrap
      // itself, so we call the endpoint directly before handing control to initFirekitCompat.
      // eslint-disable-next-line no-undef
      const res = await fetch(`${ROAR_API_URL}/v1/users/anonymous`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        console.error('POST /users/anonymous failed:', res.status, json);
        return;
      }
      const { data } = json;

      // Resolve variantId: use URL param if provided, otherwise fall back to the
      // first published variant for this task.
      // TODO: Replace with a proper "default variant" concept once the task_variants
      // schema supports marking a single variant as default per task.
      // See: https://github.com/yeatmanlab/roar-project-management/issues/1828
      let resolvedVariantId = variantId;
      if (!resolvedVariantId) {
        // eslint-disable-next-line no-undef
        const variantRes = await fetch(`${ROAR_API_URL}/v1/tasks/${pa.PA_TASK_ID}/variants?perPage=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const variantJson = await variantRes.json();
        if (!variantRes.ok) {
          console.error('Failed to fetch roar-pa task variants:', variantRes.status, variantJson);
          return;
        }
        resolvedVariantId = variantJson?.data?.items?.[0]?.id ?? null;
        if (!resolvedVariantId) {
          console.error('Could not resolve a roar-pa task variant:', variantJson);
          return;
        }
      }

      const ctx = {
        // eslint-disable-next-line no-undef
        baseUrl: `${ROAR_API_URL}/v1`,
        auth: { getToken: () => user.getIdToken() },
        participant: { participantId: data.id },
      };

      initFirekitCompat(ctx, {
        variantId: resolvedVariantId,
        taskVersion,
        isAnonymous: true,
      });

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
