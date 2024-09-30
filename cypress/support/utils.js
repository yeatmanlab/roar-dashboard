import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../src/store/auth.js';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDevFirebase } from './devFirebase.js';
import axios from 'axios';
import featurePackageJson from '../../package.json';

/**
 * Generates a randomized name by appending a random 10-digit number to the provided organization name.
 *
 * @param {string} orgName - The base name of the organization.
 * @returns {string} - The randomized name.
 */
export const randomizeName = (orgName) => {
  return `${orgName}` + ' ' + `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
};

/**
 * Checks if the specified app's version in the feature branch matches the version in the main branch.
 *
 * @param {string} app - The name of the app to check the version for.
 * @returns {Promise<boolean>} - Returns true if the app version matches the main branch version, otherwise false.
 */
export const isCurrentVersion = async (app) => {
  const featureDependencies = featurePackageJson.dependencies;

  const owner = 'yeatmanlab';
  const repository = 'roar-dashboard';
  const filePath = 'package.json';
  const branch = 'main';

  const url = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;

  try {
    const response = await axios.get(url);
    const mainPackageJson = JSON.parse(window.atob(response.data.content), 'utf-8');
    const mainDependencies = mainPackageJson.dependencies;

    const mainAppVersion = mainDependencies[app];
    const currentAppVersion = featureDependencies[app];

    return mainAppVersion === currentAppVersion;
  } catch (error) {
    console.error(`Failed to check if ${app} is the current version: ${error}`);
    return false;
  }
};

/**
 * Create a mock store for the user type specified.
 * @param {string} userType - The type of user to create a mock store for. One of 'superAdmin', 'partnerAdmin', or 'participant'. Defaults to 'participant'.
 * @returns {object} - The mock store object
 */
export const createMockStore = (userType = 'participant') => {
  const userTypes = {
    // Add user data as needed here
    superAdmin: {},
    partnerAdmin: {},
    participant: {
      uid: Cypress.env('participantUid'),
      username: Cypress.env('participantUsername'),
      password: Cypress.env('participantPassword'),
      email: Cypress.env('participantEmail'),
      name: {
        first: 'Cypress',
        last: 'Student',
      },
    },
  };

  setActivePinia(createPinia());
  const authStore = useAuthStore();

  // Patch the store with the user data as needed here
  authStore.$patch({
    firebaseUser: {
      adminFirebaseUser: {
        uid: userTypes[userType].uid,
        email: userTypes[userType].email,
        isUserAuthedAdmin: true,
        isUserAuthedApp: true,
        isAuthenticated: true,
      },
      appFirebaseUser: {
        uid: userTypes[userType].uid,
        email: userTypes[userType].email,
        isUserAuthedAdmin: true,
        isUserAuthedApp: true,
        isAuthenticated: true,
      },
    },
    roarfirekit: {
      initialized: true,
      restConfig: {
        admin: {
          baseURL: Cypress.env('firestoreAdminUrl'),
        },
        app: {
          baseURL: Cypress.env('firestoreAppUrl'),
        },
      },
    },
    userData: {
      uid: userTypes[userType].uid,
      email: userTypes[userType].email,
      username: userTypes[userType].username,
      name: {
        first: userTypes[userType].name.first,
        last: userTypes[userType].name.last,
      },
    },
  });

  return authStore;
};

/**
 * Retrieves the Firebase app, Auth, and Firestore services for the specified environment (e.g., 'adminDev' or 'assessmentDev').
 * This function abstracts the process of accessing Firebase services based on the provided environment name.
 *
 * @param {string} name - The environment name (e.g., 'adminDev', 'assessmentDev') used to get the corresponding Firebase configuration.
 * @returns {Object} - An object containing the Firebase app, Auth, and Firestore services for the specified environment.
 */
export const useDevFirebase = (name) => {
  const firebase = getDevFirebase(name);
  return {
    app: firebase?.app,
    auth: firebase?.auth,
    db: firebase?.db,
  };
};

/**
 * Signs in as a Super Admin using Firebase Authentication within a Cypress test.
 * The credentials (email and password) are pulled from Cypress environment variables.
 *
 * @param {Object} auth - The Firebase Auth instance used to sign in.
 * @returns {Promise<Object>} - A promise that resolves to the authenticated user object after a successful sign-in.
 */
export function signInAsSuperAdmin(auth) {
  cy.then(() =>
    signInWithEmailAndPassword(auth, Cypress.env('superAdminEmail'), Cypress.env('superAdminPassword')),
  ).then((userCredential) => userCredential.user);
}
