/**
 * Auth Session
 *
 * @constant {number} AUTH_SESSION_TIMEOUT_LIMIT - Session timeout limit (in ms) before dialog is shown.
 * @constant {number} AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION - Session signout countdown duration (in ms).
 * @constant {number} AUTH_SESSION_SIGNOUT_THRESHOLD - Session signout threshold (in ms) before signout is triggered.
 */
export const AUTH_SESSION_TIMEOUT_LIMIT = import.meta.env.SESSION_TIMEOUT_LIMIT || 15 * 60 * 1000;
export const AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION = import.meta.env.SESSION_TIMEOUT_COUNTDOWN_DURATION || 60 * 1000;
export const AUTH_SESSION_SIGNOUT_THRESHOLD = AUTH_SESSION_TIMEOUT_LIMIT + AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION;
