import { isEmulator } from '@/helpers';

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

export const FIRESTORE_BASE_URL = isEmulator ? 'http://127.0.0.1:8180/v1/' : 'https://firestore.googleapis.com/v1/';
