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
 * SSO Auto-Redirect Domain Mappings
 *
 * Maps email domains to their corresponding SSO providers.
 * When a user enters an email with one of these domains, they will be
 * automatically redirected to the appropriate SSO provider.
 *
 * @constant {Object.<string, string>} SSO_DOMAIN_MAPPINGS - Domain suffix to provider mapping
 *
 * @example
 * To add a new auto-redirect domain:
 * '@example.edu': AUTH_SSO_PROVIDERS.CLEVER,
 * '@school.org': AUTH_SSO_PROVIDERS.CLASSLINK,
 */
export const SSO_DOMAIN_MAPPINGS = Object.freeze({
  '@nycstudents.net': AUTH_SSO_PROVIDERS.NYCPS,
  '@schools.nyc.gov': AUTH_SSO_PROVIDERS.NYCPS,
  // Add more domain mappings here as needed
  // '@example.edu': AUTH_SSO_PROVIDERS.CLEVER,
});

/**
 * Get the SSO provider for an email based on domain auto-redirect mappings
 *
 * @param {string} email - The email address to check
 * @returns {string|null} The SSO provider constant if a match is found, null otherwise
 *
 * @example
 * getAutoRedirectSSOProvider('student@nycstudents.net') // returns 'nycps'
 * getAutoRedirectSSOProvider('user@gmail.com') // returns null
 */
export const getAutoRedirectSSOProvider = (email) => {
  if (!email || typeof email !== 'string') return null;

  const lowercaseEmail = email.toLowerCase().trim();

  // Find the first matching domain
  for (const [domain, provider] of Object.entries(SSO_DOMAIN_MAPPINGS)) {
    if (lowercaseEmail.endsWith(domain)) {
      return provider;
    }
  }

  return null;
};
