import { RoarFirekit } from '@bdelab/roar-firekit';
import roarFirebaseConfig from './config/firebaseRoar';
import levanteFirebaseConfig from './config/firebaseLevante';
import { isLevante } from './helpers';

const roarConfig = isLevante ? levanteFirebaseConfig : roarFirebaseConfig;

export async function initNewFirekit() {
  const firekit = new RoarFirekit({
    roarConfig,
    authPersistence: 'session',
    markRawConfig: {
      auth: false,
      db: false,
      functions: false,
    },
    verboseLogging: isLevante ? false : true,

    // The site key is used for app check token verification
    // The debug token is used to bypass app check for local development
    siteKey: roarConfig.siteKey,
    debugToken: roarConfig?.debugToken,
  });
  return await firekit.init();
}
