import { fetchDocById } from '@/helpers/query/utils';
import { getRoarApiClient } from '@/clients/roar-api';

/**
 * Whether the dashboard is pointed at the local Firebase Auth emulator.
 * Set via VITE_FIREBASE_EMULATOR_ENABLED; inert (false) in deployed builds.
 */
const isFirebaseEmulatorEnabled =
  import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === true || import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === 'true';

/**
 * Resolve the authenticated user's claims object: `{ claims: { super_admin, ... } }`.
 *
 * Production path: read the legacy `userClaims` document from Firestore.
 *
 * Local emulator path: the Firestore claims document is not available against
 * the local stack (only the Auth emulator runs), so derive the one claim the
 * dashboard currently gates super-admin access on — `super_admin` — from the
 * backend `/me` response instead. This branch is gated on
 * `VITE_FIREBASE_EMULATOR_ENABLED` and is a no-op in deployed builds, so the
 * production Firestore claims path is left untouched while the broader
 * off-Firestore claims migration is still pending.
 *
 * @param {string} uid - The Firebase (admin) UID used to look up Firestore claims.
 * @returns {Promise<{ claims: object } | undefined>} The userClaims object.
 */
export async function resolveUserClaims(uid) {
  if (isFirebaseEmulatorEnabled) {
    const response = await getRoarApiClient().me.get();
    const isSuperAdmin = response?.status === 200 ? Boolean(response.body?.data?.isSuperAdmin) : false;
    return { claims: { super_admin: isSuperAdmin } };
  }

  return fetchDocById('userClaims', uid);
}
