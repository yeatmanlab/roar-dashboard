import { oneMinuteInMs, oneSecondInMs } from './time.js';

/**
 * Auth Session
 *
 * @constant {number} AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD - Session timeout limit (in ms) before dialog is shown.
 * @constant {number} AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION - Session timeout countdown duration (in ms).
 */
export const AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD =
  parseInt(import.meta.env.VITE_AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD, 10) || 15 * oneMinuteInMs;
export const AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION =
  parseInt(import.meta.env.VITE_AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION, 10) || 60 * oneSecondInMs;

/**
 * Auth User Type
 *
 * @constant {Object} AUTH_USER_TYPE - User type, admin or participant.
 */
export const AUTH_USER_TYPE = Object.freeze({
  ADMIN: 'admin',
  GUEST: 'guest',
  PARTICIPANT: 'participant',
  STUDENT: 'student',
  SUPER_ADMIN: 'super-admin',
  LAUNCH_ADMIN: 'launch-admin',
});

/**
 * Auth SSO Providers
 *
 * @constant {Object} AUTH_SSO_PROVIDERS - The sources of SSO authentication.
 */
export const AUTH_SSO_PROVIDERS = Object.freeze({
  CLEVER: 'clever',
  CLASSLINK: 'classlink',
  GOOGLE: 'google',
  NYCPS: 'nycps',
});

/**
 * Auth Providers
 *
 * The provider vocabulary firekit's link/unlink methods expect — its own
 * `AuthProviderType`, which it translates into a Firebase provider ID
 * internally. Distinct from `FIREBASE_AUTH_PROVIDER_IDS`, which holds the IDs
 * Firebase reports back on `user.providerData`. Password is not SSO, so it
 * lives here rather than in `AUTH_SSO_PROVIDERS`.
 *
 * @constant {Object} AUTH_PROVIDERS - Providers accepted by firekit link/unlink.
 */
export const AUTH_PROVIDERS = Object.freeze({
  ...AUTH_SSO_PROVIDERS,
  PASSWORD: 'password',
});

export const TERMS_OF_SERVICE_DOCUMENT_PATH = '/docs/roar-terms-of-service.pdf';
export const USER_ICON_IMAGE_PATH = '/assets/img/cute-lion.png';
