import posthogInstance from '@/plugins/posthog';
import * as Sentry from '@sentry/vue';
// Get package info
import packageJson from '../package.json';

interface UserData {
  uid: string;
  email: string;
  // Add other user properties you might want to track
  [key: string]: any; // Allow other properties
}

const isProduction = import.meta.env.MODE === 'production';
// const isProduction = import.meta.env.VITE_FIREBASE_PROJECT==='PROD'; // can be used for more accurate logging

// Get app and core-tasks versions
const appVersion = packageJson.version;
const coreTasksVersion = packageJson.dependencies['@levante-framework/core-tasks'].replace('^', '');
const commitHash = import.meta.env.VITE_APP_VERSION;
let currentUser: UserData | null = null;

/**
 * Logs an event for analytics.
 * In production, sends the event to PostHog.
 * Otherwise, logs to the console.
 *
 * @param name - The name of the event.
 * @param properties - Optional properties associated with the event.
 */
function capture(name: string, properties?: Record<string, any>, force: boolean = false): void {
  const extra = {
    appVersion,
    coreTasksVersion,
    commitHash,
    ...properties,
  };
  if (isProduction || force) {
    // Assuming posthogInstance might be the mock object in dev, check for capture existence
    if (typeof posthogInstance.capture === 'function') {
      posthogInstance.capture(name, extra);
    }
  } else {
    console.info('[Logger Event]', name, extra ?? '');
  }
}

/**
 * Logs an error.
 * In production, sends the error to Sentry.
 * Otherwise, logs to the console.
 *
 * @param error - The error object (Error or unknown).
 * @param context - Optional additional context for Sentry.
 */
function error(error: Error | unknown, context?: Record<string, any>, force: boolean = false): void {
  const extra = {
    appVersion,
    coreTasksVersion,
    commitHash,
    ...context,
  };
  if (isProduction || force) {
    Sentry.captureException(error, { extra });
  } else {
    console.error('[Logger Error]', error, extra ?? '');
  }
}

/**
 * Sets user information for analytics and error reporting.
 * In production, identifies the user in PostHog and Sentry.
 * If null is passed, resets user data in PostHog and Sentry.
 * Otherwise, logs to the console.
 *
 * @param userData - An object containing user information (e.g., uid, email) or null to reset.
 */
function setUser(userData: UserData | null, force: boolean = false): void {
  if (isProduction || force) {
    if (userData) {
      // Check for identify existence on posthogInstance due to mock in dev
      // Only set identify if the user has changed since this is a backend call
      if (typeof posthogInstance.identify === 'function' && currentUser?.uid !== userData.uid) {
        posthogInstance.identify(userData.uid, {
          email: userData.email,
        });
      }
      const { uid, email } = userData;
      Sentry.setUser({ id: uid, email });
      currentUser = userData;
    } else {
      // Check for reset existence on posthogInstance due to mock in dev
      if (typeof posthogInstance.reset === 'function' && !!currentUser?.uid) {
        posthogInstance.reset();
      }
      Sentry.setUser(null);
      currentUser = null;
    }
  } else {
    if (userData) {
      console.info('[Logger SetUser]', userData);
    } else {
      console.info('[Logger ResetUser]');
    }
  }
}

export const logger = {
  capture,
  error,
  setUser,
};
