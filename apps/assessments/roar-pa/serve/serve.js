import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initFirekitCompat } from '@yeatmanlab/assessment-sdk/compat/firekit';
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

const earlyStopping = urlParams.get('earlyStopping')?.toLocaleLowerCase() ?? null;
const threshold = urlParams.get('threshold') ?? null;
const patience = urlParams.get('patience') ?? null;
const tolerance = urlParams.get('tolerance') ?? null;
const logicalOperation = urlParams.get('logicalOperation')?.toLocaleLowerCase() ?? null;
const randomSeed = urlParams.get('random') ?? null;
const isAdaptive = urlParams.get('isAdaptive') === 'true';
const itemSelect = urlParams.get('itemSelect') ?? 'fixed';
const abilityMethod = urlParams.get('abilityMethod')?.toLocaleLowerCase() ?? 'eap';

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const token = await user.getIdToken();

      // Raw fetch is intentional here: the SDK requires a participantId (ROAR UUID) to
      // initialize, but this call is what provisions that UUID. The SDK can't bootstrap
      // itself, so we call the endpoint directly before handing control to initFirekitCompat.
      // eslint-disable-next-line no-undef
      baseUrl: ROAR_API_URL,
      auth: { getToken: () => user.getIdToken() },
      participant: { participantId: data.id },
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

await signInAnonymously(auth);
