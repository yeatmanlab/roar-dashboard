import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseCoreClient } from './firebase-core.client';

/**
 * Firebase Auth Client
 *
 * Ready-to-use Admin Firebase Auth instance bound to the singleton Admin app.
 * Import and use directly.
 *
 * Module-load safe (no ADC at import time): the underlying `Auth` instance is
 * resolved lazily on first property access via a Proxy. This ensures that
 * simply importing this module — for example during a unit test that never
 * touches Firebase — does not trigger `FirebaseCoreClient.getApp()` and the
 * `applicationDefault()` lookup that can attempt a metadata-server call in CI.
 *
 * @example
 * ```ts
 *   import { FirebaseAuthClient } from './firebase-auth.clients';
 *   await FirebaseAuthClient.verifyIdToken(token, true);
 * ```
 */
let cachedAuth: Auth | null = null;

function getAuthInstance(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(FirebaseCoreClient.getApp());
  return cachedAuth;
}

export const FirebaseAuthClient: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuthInstance(), prop, receiver);
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getAuthInstance(), prop, value, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getAuthInstance(), prop);
  },
  ownKeys() {
    return Reflect.ownKeys(getAuthInstance());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getAuthInstance(), prop);
  },
});
