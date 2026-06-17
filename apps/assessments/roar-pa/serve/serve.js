import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { initFirekitCompat, getVariantById } from '@roar-platform/assessment-sdk/compat/firekit';
import { pa } from '@roar-platform/assessment-schema';
import RoarPA from '../src/index';
import { getFirebaseConfig } from '../../shared/firebaseConfig';
import { wireScoreAdapter } from '../src/sdk/pa-firekit-facade';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';

const queryString = new URL(window.location).search;
const urlParams = new URLSearchParams(queryString);

// Variant / session
const variantId = urlParams.get('variantId');
const taskVersion = urlParams.get('taskVersion') ?? '1.0';

// User / participant params — game configuration comes from variant params fetched via SDK
const assessmentPid = urlParams.get('participant');
const labId = urlParams.get('labId');
const grade = urlParams.get('grade');
const birthYear = urlParams.get('birthyear');
const birthMonth = urlParams.get('birthmonth');
const age = urlParams.get('age');
const ageMonths = urlParams.get('agemonths');

const firebaseConfig = await getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// eslint-disable-next-line no-undef
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // eslint-disable-next-line no-undef
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const token = await user.getIdToken();

      // Raw fetch is intentional here: the SDK requires a participantId (ROAR UUID) to
      // initialize, but this call is what provisions that UUID. The SDK can't bootstrap
      // itself, so we call the endpoint directly before handing control to initFirekitCompat.
      // eslint-disable-next-line no-undef
      const res = await fetch(`${ROAR_API_BASE_URL}/users/anonymous`, {
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
        const variantRes = await fetch(`${ROAR_API_BASE_URL}/tasks/${pa.PA_TASK_ID}/variants?perPage=1`, {
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
        baseUrl: ROAR_API_BASE_URL,
        auth: { getToken: () => user.getIdToken() },
        participant: { participantId: data.id },
      };

      initFirekitCompat(ctx, {
        variantId: resolvedVariantId,
        taskVersion,
        isAnonymous: true,
      });

      // Wire PA score computation pipeline
      wireScoreAdapter();

      const { variantParams } = await getVariantById(resolvedVariantId);

      const userParams = {
        assessmentPid,
        labId,
        grade,
        birthMonth,
        birthYear,
        age,
        ageMonths,
      };

      const roarApp = new RoarPA(variantParams, userParams);
      roarApp.run();
    } catch (err) {
      console.error('Failed to initialize assessment:', err);
    }
  }
});

await signInAnonymously(auth);
