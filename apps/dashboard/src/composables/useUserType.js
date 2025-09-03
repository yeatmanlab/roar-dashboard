import { computed } from 'vue';
import { AUTH_USER_TYPE } from '@/constants/auth';
import _isEmpty from 'lodash/isEmpty';
import { UserRoles } from '@bdelab/roar-firekit';

/**
 * Get user type
 *
 * Composable function to determine the user type based on the user claims. The user type can be either an admin or a
 * participant. The user type is determined based on the user claims, where a user is considered an admin if they have
 * the corresponding super_admin or miniamlAdminOrgs claims.
 *
 * Notes:
 * - super_admin → SUPER_ADMIN
 * - launch_admin → LAUNCH_ADMIN
 * - admin → ADMIN
 * - minimalAdminOrgs (non-empty) → ADMIN
 * - otherwise → PARTICIPANT
 *
 * @param {Object} userClaims - The user claims object.
 * @returns {Object} The user type and related computed properties.
 */
export default function useUserType(userClaims) {
  const userType = computed(() => {
    // Abort the user type determination if the user claims are not available yet.
    if (!userClaims.value?.claims) return;

    const claims = userClaims.value.claims;

    // Check if the user is a super admin.
    if (claims?.super_admin) {
      return AUTH_USER_TYPE.SUPER_ADMIN;
    }

    if (claims?.role === UserRoles.LAUNCH_ADMIN) {
      return AUTH_USER_TYPE.LAUNCH_ADMIN;
    }

    // Check if the user has any minimal admin organizations.
    const minimalAdminOrgs = claims?.minimalAdminOrgs || {};
    const hasMinimalAdminOrgs = Object.values(minimalAdminOrgs).some((org) => !_isEmpty(org));

    if (hasMinimalAdminOrgs || claims?.role === UserRoles.ADMIN) {
      return AUTH_USER_TYPE.ADMIN;
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
