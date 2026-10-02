import { oneMinuteInMs, oneSecondInMs } from './time.js';

/**
 * Auth Session
 *
 * @constant {number} AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD - Session timeout limit (in ms) before dialog is shown.
 * @constant {number} AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION - Session timeout countdown duration (in ms).
 */
/**
 * Parse an env-provided duration, falling back only when the variable is
 * absent or not a number. `parseInt(x) || fallback` would also discard an
 * explicit `0`, making the value unsettable.
 *
 * @param {string | undefined} rawValue - The env variable's raw string value.
 * @param {number} fallbackMs - Default duration when the variable is unset or invalid.
 * @returns {number} The parsed duration in milliseconds.
 */
function parseDurationEnv(rawValue, fallbackMs) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

export const AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD = parseDurationEnv(
  import.meta.env.VITE_AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD,
  15 * oneMinuteInMs,
);
export const AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION = parseDurationEnv(
  import.meta.env.VITE_AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION,
  60 * oneSecondInMs,
);

/**
 * How long the router's first navigation waits for Firebase to report the
 * session before giving up and treating the visitor as signed out.
 *
 * The gate only waits on Firebase initialization and its first token
 * emission — not on a token arriving over the network — so the bound is far
 * tighter than the 20s grace timer it replaced on the SSO landing page.
 * Generous enough for a cold cache on a weak device; short enough that a
 * hung init does not look like a hang to the user.
 *
 * @constant {number} AUTH_READY_TIMEOUT_MS
 */
export const AUTH_READY_TIMEOUT_MS = 10 * oneSecondInMs;

/**
 * How long the router guard waits for the first `/me` fetch before letting
 * the navigation proceed without it. A timeout degrades the guard: the
 * unsigned-TOS gate is skipped and the super-admin check falls back to the
 * persisted store claims, both re-evaluated on the next navigation. The
 * guard logs a warning breadcrumb when this fires.
 *
 * @constant {number} ROUTER_ME_PREFETCH_TIMEOUT_MS
 */
export const ROUTER_ME_PREFETCH_TIMEOUT_MS = 5 * oneSecondInMs;

/**
 * Auth User Type
 *
 * @constant {Object} AUTH_USER_TYPE - User type, admin or participant.
 */
export const AUTH_USER_TYPE = Object.freeze({
  ADMIN: 'admin',
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
 * Auth-store flags set by the OAuth landing pages (AuthSSO.vue) and consumed
 * by SignIn's onMounted to re-trigger the corresponding SSO flow after the
 * identity provider redirects back. Keyed by AUTH_SSO_PROVIDERS values;
 * Google has no entry because it never routes through the landing pages.
 * Lives here, next to AUTH_SSO_PROVIDERS, so adding a provider updates the
 * provider list and its flag in one place.
 *
 * @constant {Object} AUTH_SSO_OAUTH_REQUEST_FLAGS - Provider → auth-store flag name.
 */
export const AUTH_SSO_OAUTH_REQUEST_FLAGS = Object.freeze({
  [AUTH_SSO_PROVIDERS.CLEVER]: 'cleverOAuthRequested',
  [AUTH_SSO_PROVIDERS.CLASSLINK]: 'classLinkOAuthRequested',
  [AUTH_SSO_PROVIDERS.NYCPS]: 'nycpsOAuthRequested',
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
