import { RoarFirekit } from '@bdelab/roar-firekit';
import roarFirebaseConfig from './config/firebaseRoar';
import levanteFirebaseConfig from './config/firebaseLevante';

const roarConfig = import.meta.env.MODE === 'LEVANTE' ? levanteFirebaseConfig : roarFirebaseConfig;

export async function initNewFirekit() {
  const firekit = new RoarFirekit({
    roarConfig,
    authPersistence: 'session',
    markRawConfig: {
      auth: false,
      db: false,
      functions: false,
    },
    verboseLogging: import.meta.env.MODE === 'LEVANTE' ? false : true,

    // The site key is used for app check token verification
    // The debug token is used to bypass the app check token requirement for local development and for PR deployments
    siteKey: roarConfig.siteKey,
    debugToken: roarConfig.debugToken,
  });
  return await firekit.init();
}
