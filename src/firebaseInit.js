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
  });
  return await firekit.init();
}
