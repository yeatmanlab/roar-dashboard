import posthogInstance from '@/plugins/posthog';
import * as Sentry from '@sentry/vue';

const isProduction = import.meta.env.VITE_FIREBASE_PROJECT==='PROD';

interface UserData {
  uid: string;
  email: string;
  // Add other user properties you might want to track
  [key: string]: any; // Allow other properties
}

/**
 * Logs an event for analytics.
 * In production, sends the event to PostHog.
 * Otherwise, logs to the console.
 *
 * @param name - The name of the event.
 * @param properties - Optional properties associated with the event.
 */
function capture(name: string, properties?: Record<string, any>, force: boolean = false): void {
  if (isProduction || force) {
    // Assuming posthogInstance might be the mock object in dev, check for capture existence
    if (typeof posthogInstance.capture === 'function') {
      posthogInstance.capture(name, properties);
    }
  } else {
    console.info('[Logger Event]', name, properties ?? '');
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
  if (isProduction || force) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('[Logger Error]', error, context ?? '');
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
function setUser(userData: UserData | null): void {
  if (isProduction) {
    if (userData) {
      // Check for identify existence on posthogInstance due to mock in dev
      if (typeof posthogInstance.identify === 'function') {
        posthogInstance.identify(userData.uid, {
          email: userData.email,
          // You can spread other userData properties if needed
          // ...userData
        });
      }
      const { uid, ...otherUserData } = userData; // Destructure uid and get the rest
      Sentry.setUser({ id: uid, ...otherUserData });
    } else {
      // Check for reset existence on posthogInstance due to mock in dev
      if (typeof posthogInstance.reset === 'function') {
        posthogInstance.reset();
      }
      Sentry.setUser(null);
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