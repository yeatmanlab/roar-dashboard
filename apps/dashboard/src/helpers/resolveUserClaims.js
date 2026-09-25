import { UserRoles } from '@bdelab/roar-firekit';
import { queryClient } from '@/queryClient';
import { fetchMe } from '@/composables/queries/useMeQuery';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Backend `/me` `userType` values that should land on the admin dashboard.
 * `admin` covers administrators/principals; `educator` covers teachers
 * (supervisory). `student` and `caregiver` are participants.
 */
const ADMIN_DASHBOARD_USER_TYPES = new Set(['admin', 'educator']);

/**
 * Derive the subset of legacy `userClaims` the dashboard gates on from a
 * backend `/me` payload. Reconstructs what `useUserType` (routing) and the
 * auth-store getters read, using `/me`'s `id`, `userType`, and `isSuperAdmin`.
 *
 * - `super_admin`: from `/me` `isSuperAdmin` (the canonical, FGA-derived flag).
 * - `roarUid`: from `/me` `id` — the ROAR user id. The auth store's `roarUid`
 *   getter reads `userClaims.claims.roarUid`, which the sign-in and SSO flows
 *   depend on.
 * - `role` / `admin`: set for admin- and educator-type users so `useUserType`
 *   resolves to ADMIN and they route to `HomeAdministrator`. The backend still
 *   scopes what they can see via FGA, so no admin-org list is needed here.
 *   Students and caregivers get neither claim and route to `HomeParticipant`.
 *
 * @param {{ id?: string, isSuperAdmin?: boolean, userType?: string } | undefined} meData - The `/me` `data` payload.
 * @returns {{ super_admin: boolean, roarUid?: string, admin?: boolean, role?: string }} The derived claims.
 */
export function deriveClaimsFromMe(meData) {
  const isSuperAdmin = Boolean(meData?.isSuperAdmin);
  const isAdminDashboardUser = ADMIN_DASHBOARD_USER_TYPES.has(meData?.userType);

  return {
    super_admin: isSuperAdmin,
    roarUid: meData?.id,
    ...(isAdminDashboardUser ? { admin: true, role: UserRoles.ADMIN } : {}),
  };
}

/**
 * Resolve the authenticated user's claims object: `{ claims: { super_admin, roarUid, ... } }`.
 *
 * Fetches the backend `/me` response (identity comes from the Bearer token)
 * and derives the claims the dashboard gates routing on via
 * {@link deriveClaimsFromMe}. The fetch goes through the singleton
 * `queryClient` under `ME_QUERY_KEY`, so it dedupes with `useMeQuery`'s cache
 * instead of issuing a second raw request. Freshness is governed by the
 * queryClient's `defaultOptions` (10 min staleTime in production, 0 under
 * Cypress) — `fetchQuery` applies those defaults, so no per-call `staleTime`
 * is needed here.
 *
 * Failures propagate to the caller — callers own the error handling (and
 * the logging: `useUserClaimsQuery` routes it through TanStack's `error`;
 * the App.vue bootstrap and the sign-in flow catch it). Failing closed to
 * `{ super_admin: false }` here would mis-route admins on transient failures.
 *
 * @returns {Promise<{ claims: object }>} The userClaims object.
 * @throws {Error} When the `/me` request fails.
 */
export async function resolveUserClaims() {
  const meData = await queryClient.fetchQuery({
    queryKey: [ME_QUERY_KEY],
    queryFn: fetchMe,
  });
  return { claims: deriveClaimsFromMe(meData) };
}
