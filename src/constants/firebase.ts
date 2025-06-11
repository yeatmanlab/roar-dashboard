/**
 * Firestore databases
 */
export const FIRESTORE_DATABASES = {
  ADMIN: 'admin',
} as const;

/**
 * Firestore database collections
 */
export const FIRESTORE_COLLECTIONS = {
  ADMINISTRATIONS: 'administrations',
  CLASSES: 'classes',
  DISTRICTS: 'districts',
  GROUPS: 'groups',
  LEGAL: 'legal',
  SCHOOLS: 'schools',
  TASKS: 'tasks',
  USER_CLAIMS: 'userClaims',
  USERS: 'users',
  GUESTS: 'guests',
} as const;
