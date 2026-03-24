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
