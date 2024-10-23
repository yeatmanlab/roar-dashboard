import { getApps, initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import devFirebaseConfig from './devFirebaseConfig';

/**
 * Initializes a Firebase app and retrieves the Auth and Firestore services.
 * If the app with the specified name already exists, it reuses the existing app.
 * Optionally connects to the Firestore emulator if `useEmulator` is true.
 *
 * @param {Object} config - The Firebase configuration object.
 * @param {string} name - The name of the Firebase app instance.
 * @param {boolean} useEmulator - A flag indicating whether to connect to the Firestore emulator.
 * @returns {Object} - An object containing the Firebase app, Auth, and Firestore services.
 */
const initializeAndGetFirebase = (config, name, useEmulator) => {
  const existingApp = getApps().find((app) => app.name === name);

  if (existingApp) {
    console.log('Found existing app:', existingApp);
  }
  const app = existingApp || initializeApp(config, name);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (useEmulator) {
    console.log('Connecting to Firestore emulator...');
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Connected to Firestore emulator.');
  }

  return {
    app,
    auth,
    db,
  };
};

/**
 * Retrieves the Firebase app, Auth, and Firestore services based on the given config key.
 * It supports multiple environments (e.g., adminDev, assessmentDev) and connects to the Firestore emulator
 * if `useEmulator` is true. Returns null if the specified config is not found.
 *
 * @param {string} config - The key for selecting the Firebase configuration (e.g., 'adminDev', 'assessmentDev').
 * @param {boolean} [useEmulator=true] - A flag indicating whether to connect to the Firestore emulator.
 * @returns {Object|null} - An object containing the Firebase app, Auth, and Firestore services, or null if no config is found.
 */
export const getDevFirebase = (config, useEmulator = false) => {
  const configMap = {
    adminDev: devFirebaseConfig.adminDev,
    assessmentDev: devFirebaseConfig.assessmentDev,
  };

  const firebaseConfig = configMap[config];
  return firebaseConfig ? initializeAndGetFirebase(firebaseConfig, config, useEmulator) : null;
};
