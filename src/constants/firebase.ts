/**
 * Firestore databases
 */
export const FIRESTORE_DATABASES = Object.freeze({
  ADMIN: 'admin',
  APP: 'app',
} as const);

export type FirestoreDatabase = typeof FIRESTORE_DATABASES[keyof typeof FIRESTORE_DATABASES];

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
} as const);

export type FirestoreCollection = typeof FIRESTORE_COLLECTIONS[keyof typeof FIRESTORE_COLLECTIONS]; 