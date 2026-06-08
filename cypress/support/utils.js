import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDevFirebase } from './devFirebase';

/**
 * Retrieves the Firebase app, Auth, and Firestore services for the specified environment.
 * This function abstracts the process of accessing Firebase services based on the provided environment name.
 *
 * @param {string} name - The environment name (e.g., 'adminDev', 'assessmentDev') used to get the corresponding Firebase configuration.
 * @returns {Object} - An object containing the Firebase app, Auth, and Firestore services for the specified environment.
 */
export const useFirebaseEmulator = (name) => {
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

/**
 * Converts an object of variant parameters into a URL query string format.
 *
 * @param {Object} params - The object containing variant parameters to be converted.
 * @returns {string} - A string representing the variant parameters in URL query string format.
 */
export function mapVariantParameters(params) {
  return Object.keys(params)
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}
