import { resolveIsFirebaseEmulatorEnabled } from '@/utils/emulator-guard';

/**
 * Firestore databases
 */
export const FIRESTORE_DATABASES = Object.freeze({
  ADMIN: 'admin',
  APP: 'app',
});

/**
 * Firestore database collections
 */
export const FIRESTORE_COLLECTIONS = Object.freeze({
  ACTIVATION_CODES: 'activationCodes',
  ADMINISTRATIONS: 'administrations',
  CLASSES: 'classes',
  DISTRICTS: 'districts',
  FAMILIES: 'families',
  GROUPS: 'groups',
  LEGAL: 'legal',
  SCHOOLS: 'schools',
  TASKS: 'tasks',
  USER_CLAIMS: 'userClaims',
  USERS: 'users',
});

/**
 * Firebase Auth provider IDs
 *
 * The `providerId` values Firebase reports on `user.providerData`. These are
 * Firebase's own identifiers and are distinct from `AUTH_SSO_PROVIDERS`, which
 * holds the ROAR-internal slugs that firekit's link/unlink calls expect.
 */
export const FIREBASE_AUTH_PROVIDER_IDS = Object.freeze({
  PASSWORD: 'password',
  GOOGLE: 'google.com',
  CLEVER: 'oidc.clever',
  CLASSLINK: 'oidc.classlink',
});

/**
 * Firebase Functions Error Codes
 */
export const FIREBASE_FUNCTIONS_ERROR_CODES = Object.freeze({
  AUTH_INTERNAL: 'auth/internal-error',
  AUTH_PERMISSION_DENIED: 'auth/permission-denied',
  AUTH_EMAIL_ALREADY_IN_USE: 'auth/email-already-in-use',
  AUTH_POPUP_CLOSED_BY_USER: 'auth/popup-closed-by-user',
  AUTH_POPUP_CANCELLED: 'auth/cancelled-popup-request',
});

export const FIREBASE_FUNCTIONS_ERROR_REASONS = Object.freeze({
  AUTH_PROVIDER_DISABLED: 'auth_provider_disabled',
});

/**
 * Whether the dashboard is pointed at the local Firebase Auth emulator.
 *
 * Derived from `VITE_FIREBASE_EMULATOR_AUTH_HOST` or the legacy
 * `VITE_FIREBASE_EMULATOR_ENABLED` flag for backward compatibility. Centralized here
 * so every consumer evaluates the flag identically.
 *
 * `resolveIsFirebaseEmulatorEnabled` throws rather than returning `true` in a
 * staging or production build — the build itself is supposed to have failed
 * first (see `assertEmulatorDisabledForDeployedBuild` in `vite.config.js`), so
 * this is the backstop for a bundle that got past it.
 *
 * Consumers: `usePermissions.js`, `composables/mutations/useSignOutMutation.js`.
 * Both branches exist to work around firekit's token claims and Auth-emulator
 * re-init; they go away with firekit (see the TODO in `usePermissions.js`).
 */
export const IS_FIREBASE_EMULATOR_ENABLED = resolveIsFirebaseEmulatorEnabled(import.meta.env);
