import { UserRoles } from '@bdelab/roar-firekit';
import { fetchDocById } from '@/helpers/query/utils';
import { getRoarApiClient } from '@/clients/roar-api';
import { IS_FIREBASE_EMULATOR_ENABLED } from '@/constants/firebase';

/**
 * Backend `/me` `userType` values that should land on the admin dashboard.
 * `admin` covers administrators/principals; `educator` covers teachers
 * (supervisory). `student` and `caregiver` are participants.
 */
const ADMIN_DASHBOARD_USER_TYPES = new Set(['admin', 'educator']);

/**
 * Derive the subset of legacy `userClaims` the dashboard gates on from a backend
 * `/me` payload. Emulator-only helper: the Firestore claims document
 * (`super_admin`, `role`, `minimalAdminOrgs`) isn't available against the local
 * stack, so reconstruct what `useUserType` (routing) and the auth-store getters
 * read, using `/me`'s `userType` + `isSuperAdmin`.
 *
 * - `super_admin`: from `/me` `isSuperAdmin` (the canonical, FGA-derived flag).
 * - `role` / `admin`: set for admin- and educator-type users so `useUserType`
 *   resolves to ADMIN and they route to `HomeAdministrator`. The backend still
 *   scopes what they can see via FGA, so no admin-org list is needed here.
 *   Students and caregivers get neither claim and route to `HomeParticipant`.
 *
 * @param {{ isSuperAdmin?: boolean, userType?: string } | undefined} meData - The `/me` `data` payload.
 * @returns {{ super_admin: boolean, admin?: boolean, role?: string }} The derived claims.
 */
export function deriveEmulatorClaims(meData) {
  const isSuperAdmin = Boolean(meData?.isSuperAdmin);
  const isAdminDashboardUser = ADMIN_DASHBOARD_USER_TYPES.has(meData?.userType);

  return {
    super_admin: isSuperAdmin,
    ...(isAdminDashboardUser ? { admin: true, role: UserRoles.ADMIN } : {}),
  };
}

/**
 * Resolve the authenticated user's claims object: `{ claims: { super_admin, ... } }`.
 *
 * Production path: read the legacy `userClaims` document from Firestore.
 *
 * Local emulator path: the Firestore claims document is not available against the
 * local stack (only the Auth emulator runs), so derive the claims the dashboard
 * gates routing on — `super_admin` plus, for admins/teachers, `role`/`admin` — from
 * the backend `/me` response via {@link deriveEmulatorClaims}. This branch is gated
 * on `VITE_FIREBASE_EMULATOR_ENABLED` and is a no-op in deployed builds, so the
 * production Firestore claims path is left untouched while the broader off-Firestore
 * claims migration is still pending.
 *
 * @param {string} uid - The Firebase (admin) UID used to look up Firestore claims.
 *   Used by the production path only; the emulator path identifies the user via the
 *   `/me` Bearer token, so `uid` is ignored there.
 * @returns {Promise<{ claims: object } | undefined>} The userClaims object.
 */
export async function resolveUserClaims(uid) {
  if (IS_FIREBASE_EMULATOR_ENABLED) {
    try {
      const response = await getRoarApiClient().me.get();
      const meData = response?.status === 200 ? response.body?.data : undefined;
      return { claims: deriveEmulatorClaims(meData) };
    } catch (error) {
      // The only backend in the local stack is server-test; if it isn't running,
      // `/me` throws a network error. Fail closed (no admin access) with a clear
      // hint rather than letting an unhandled rejection break the sign-in flow.
      console.error('[resolveUserClaims] emulator: failed to reach /me — is the local backend running?', error);
      return { claims: { super_admin: false } };
    }
  }

  return fetchDocById('userClaims', uid);
}
