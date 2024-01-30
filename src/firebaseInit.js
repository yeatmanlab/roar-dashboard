import { RoarFirekit } from '@bdelab/roar-firekit';
import firebaseConfig from './config/firebase';
import levanteFirebaseConfig from './config/levanteFirebase';

export async function initNewFirekit() {
  console.log('process: ', import.meta.env.MODE)

  const firekit = new RoarFirekit({
    roarConfig: import.meta.env.MODE === 'LEVANTE' ? levanteFirebaseConfig : firebaseConfig,
    authPersistence: 'session',
    markRawConfig: {
      auth: false,
      db: false,
      functions: false,
    },
  });
  return await firekit.init();
}
