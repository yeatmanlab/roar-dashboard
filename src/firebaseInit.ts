import { RoarFirekit, RoarConfig, AuthPersistence } from '@levante-framework/firekit';
import levanteFirebaseConfig from './config/firebaseLevante';
import { isLevante } from './helpers';

const roarConfig: RoarConfig = levanteFirebaseConfig;

export async function initNewFirekit(): Promise<RoarFirekit> {
  console.log('Initializing Firekit with config:', roarConfig);
  const firekit = new RoarFirekit({
    roarConfig,
    authPersistence: AuthPersistence.SESSION,
    markRawConfig: {
      auth: false,
      db: false,
      functions: false,
    },
    verboseLogging: isLevante ? false : true,

    // The site key is used for app check token verification
    // The debug token is used to bypass app check for local development
    siteKey: roarConfig?.siteKey,
    debugToken: roarConfig?.debugToken,
  });
  console.log('Firekit instance created, initializing...');
  try {
    const initializedFirekit = await firekit.init();
    console.log('Firekit initialized successfully');
    return initializedFirekit;
  } catch (error) {
    console.error('Error initializing Firekit:', error);
    throw error;
  }
} 