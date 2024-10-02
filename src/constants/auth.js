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
});
