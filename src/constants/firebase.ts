/**
 * Firestore databases
 */
export const FIRESTORE_DATABASES = {
  ADMIN: 'admin',
  APP: 'app',
} as const;

/**
 * Firestore database collections
 */
export const FIRESTORE_COLLECTIONS = {
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
} as const;
