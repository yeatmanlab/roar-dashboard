import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseCoreClient } from './firebase-core.client';

/**
 * Firebase Auth Client
 *
 * Ready-to-use Admin Firebase Auth instance bound to the singleton Admin app.
 * Import and use directly.
 *
 * @example
 * ```ts
 *   import { FirebaseAuthClient } from './firebase-auth.clients';
 *   await FirebaseAuthClient.verifyIdToken(token, true);
 * ```
 */
export const FirebaseAuthClient: Auth = getAuth(FirebaseCoreClient.getApp());
