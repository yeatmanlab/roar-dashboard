import { log } from '../src/experiment/config/logger';

const devFirebaseConfig = {
  apiKey: 'AIzaSyCEUxEgYMp4fg2zORT0lsgn4Q6CCoMVzjU',
  authDomain: 'gse-roar-assessment-dev.firebaseapp.com',
  projectId: 'gse-roar-assessment-dev',
  storageBucket: 'gse-roar-assessment-dev.appspot.com',
  messagingSenderId: '26086061121',
  appId: '1:26086061121:web:262163d6c145b7a80bc2c0',
  siteKey: '6Ldq2SEqAAAAAKXTxXs9GnykkEZLYeVijzAKzqfQ',
  debugToken: process.env.APPCHECK_DEBUG_TOKEN,
};

const emulatorFirebaseConfig = {
  ...devFirebaseConfig,
  emulatorPorts: {
    db: 8080,
    auth: 9099,
    functions: 9000,
    hosting: 5000,
  },
};

const stagingFirebaseConfig = {
  apiKey: 'AIzaSyCGNBjSVXvvglqH0jdNFnyEd9pyyLqNXN8',
  authDomain: 'gse-roar-assessment-staging.firebaseapp.com',
  projectId: 'gse-roar-assessment-staging',
  storageBucket: 'gse-roar-assessment-staging.firebasestorage.app',
  messagingSenderId: '974990981425',
  appId: '1:974990981425:web:67edfcef6dd3bd7b50d810',
};

const productionFirebaseConfig = {
  apiKey: 'AIzaSyDw0TnTXbvRyoVo5_oa_muhXk9q7783k_g',
  authDomain: 'gse-roar-assessment.firebaseapp.com',
  projectId: 'gse-roar-assessment',
  storageBucket: 'gse-roar-assessment.appspot.com',
  messagingSenderId: '757277423033',
  appId: '1:757277423033:web:d6e204ee2dd1047cb77268',
  siteKey: '6Lc54SEqAAAAAKJF8QNpEzU6wHtXGAteVvrdB8XK',
};

let firebaseConfigWrapper;

// eslint-disable-next-line no-undef
if (ROAR_DB === 'development') {
  firebaseConfigWrapper = devFirebaseConfig;
  // eslint-disable-next-line no-undef
} else if (ROAR_DB === 'emulator') {
  firebaseConfigWrapper = emulatorFirebaseConfig;
  // eslint-disable-next-line no-undef
} else if (ROAR_DB === 'staging') {
  firebaseConfigWrapper = stagingFirebaseConfig;
  // eslint-disable-next-line no-undef
} else if (ROAR_DB === 'production') {
  firebaseConfigWrapper = productionFirebaseConfig;
} else {
  throw new Error(
    // eslint-disable-next-line no-undef
    `Invalid ROAR_DB environment variable value. Expected "development", "emulator", "staging", or "production". Received ${ROAR_DB}.`,
  );
}

export const firebaseConfig = { ...firebaseConfigWrapper };

export const roarConfig = {
  firebaseConfig,
};

const logMessage = `This ROAR app will write data to the ${roarConfig.firebaseConfig.projectId} firestore database`;
log.info(logMessage);
