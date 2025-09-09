import { computed } from 'vue';
import { AUTH_USER_TYPE } from '@/constants/auth';
import _isEmpty from 'lodash/isEmpty';
import { UserRoles } from '@bdelab/roar-firekit';

/**
 * Get user type
 *
 * Composable function to determine the user's role based on the user claims. The user role can be either an admin or a
 * participant. The user's role is determined based on the user claims, where a user is considered an admin if they have
 * the corresponding super_admin or miniamlAdminOrgs claims.
 *
 * Notes:
 * - Naming note: Despite the name `useUserType`, this composable infers an **admin-vs-participant role** from admin-side
 *   userRoles/claims (dashboard/admin) rather than reading an explicit `userType` (e.g., educator, caregiver). This has led
 *   to confusion when `UserType` and `UserRole` diverge.
 * - Future plan: We intend to align `role` and `type` so they represent the same concept.
 *
 * - super_admin → SUPER_ADMIN
 * - launch_admin → LAUNCH_ADMIN
 * - admin → ADMIN
 * - minimalAdminOrgs (non-empty) → ADMIN
 * - otherwise → PARTICIPANT
 *
 * @param {Object} userClaims - The user claims object.
 * @returns {Object} The user role and related computed properties.
 */
export default function useUserType(userClaims) {
  // These userTypes are actually userRoles
  const userType = computed(() => {
    // Abort the user type determination if the user claims are not available yet.
    if (!userClaims.value) return;

    const claims = userClaims.value.claims;

    // Check if the user is a super admin.
    if (claims?.super_admin) {
      return AUTH_USER_TYPE.SUPER_ADMIN;
    }

const roleTypeMap = {
  [UserRoles.LAUNCH_ADMIN]: AUTH_USER_TYPE.LAUNCH_ADMIN,
  [UserRoles.ADMIN]: AUTH_USER_TYPE.ADMIN,
}
if (claims?.role && roleTypeMap[claims.role]) {
  return roleTypeMap[claims.role];

    } else {
      // Check if the user has any minimal admin organizations.
      const minimalAdminOrgs = claims?.minimalAdminOrgs || {};
      const hasMinimalAdminOrgs = Object.values(minimalAdminOrgs).some((org) => !_isEmpty(org));

return hasMinimalAdminOrgs ? AUTH_USER_TYPE.ADMIN : undefined
    }

    // Otherwise, default to participant user type.
    return AUTH_USER_TYPE.PARTICIPANT;
  });

  const isAdmin = computed(() => userType.value === AUTH_USER_TYPE.ADMIN);
  const isParticipant = computed(() => userType.value === AUTH_USER_TYPE.PARTICIPANT);
  const isSuperAdmin = computed(() => userType.value === AUTH_USER_TYPE.SUPER_ADMIN);
  const isLaunchAdmin = computed(() => userType.value === AUTH_USER_TYPE.LAUNCH_ADMIN);

  return {
    userType,
    isAdmin,
    isParticipant,
    isSuperAdmin,
    isLaunchAdmin,
  };
}
