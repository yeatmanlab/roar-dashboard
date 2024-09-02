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
export const AUTH_USER_TYPE = {
  ADMIN: 'admin',
  PARTICIPANT: 'participant',
  SUPER_ADMIN: 'super-admin',
};
