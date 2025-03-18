import { RoarFirekit } from '@levante-framework/firekit';
import levanteFirebaseConfig from './config/firebaseLevante';
import { isLevante } from './helpers';

const firebaseConfig = levanteFirebaseConfig;

export async function initNewFirekit() {
  const firekit = new RoarFirekit({
    firebaseConfig,
    authPersistence: 'session',
    markRawConfig: {
      auth: false,
      db: false,
      functions: false,
    },
    verboseLogging: isLevante ? false : true,

    // The site key is used for app check token verification
    // The debug token is used to bypass app check for local development
    siteKey: firebaseConfig.siteKey,
    debugToken: firebaseConfig?.debugToken,
  });
  return await firekit.init();
}
