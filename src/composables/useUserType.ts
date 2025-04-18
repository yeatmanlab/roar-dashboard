import { computed, type Ref, type ComputedRef } from 'vue';
import { AUTH_USER_TYPE } from '@/constants/auth';
import _isEmpty from 'lodash/isEmpty';

// Define the structure of the claims object
interface Claims {
  super_admin?: boolean;
  minimalAdminOrgs?: Record<string, any>; // Use Record<string, any> for flexibility, refine if structure is known
}

// Define the structure for the value inside the userClaims ref
interface UserClaimsValue {
  claims: Claims;
  // Add other potential properties if known
}

// Define the return type of the composable
interface UseUserTypeReturn {
  userType: ComputedRef<string | undefined>; // AUTH_USER_TYPE values are likely strings
  isAdmin: ComputedRef<boolean>;
  isParticipant: ComputedRef<boolean>;
  isSuperAdmin: ComputedRef<boolean>;
}

/**
 * Get user type
 *
 * Composable function to determine the user type based on the user claims. The user type can be either an admin or a
 * participant. The user type is determined based on the user claims, where a user is considered an admin if they have
 * the corresponding super_admin or miniamlAdminOrgs claims.
 *
 * @param {Ref<UserClaimsValue | null | undefined>} userClaims - The user claims object ref.
 * @returns {UseUserTypeReturn} The user type and related computed properties.
 */
export default function useUserType(userClaims: Ref<UserClaimsValue | null | undefined>): UseUserTypeReturn {
  const userType: ComputedRef<string | undefined> = computed(() => {
    // Abort the user type determination if the user claims are not available yet.
    if (!userClaims.value) return undefined;

    const claims = userClaims.value.claims;

    // Check if the user is a super admin.
    if (claims?.super_admin) {
      return AUTH_USER_TYPE.SUPER_ADMIN;
    }

    // Check if the user has any minimal admin organizations.
    const minimalAdminOrgs = claims?.minimalAdminOrgs || {};
    const hasMinimalAdminOrgs = Object.values(minimalAdminOrgs).some((org: any) => !_isEmpty(org));

    if (hasMinimalAdminOrgs) {
      return AUTH_USER_TYPE.ADMIN;
    }

    // Otherwise, default to participant user type.
    return AUTH_USER_TYPE.PARTICIPANT;
  });

  const isAdmin: ComputedRef<boolean> = computed(() => userType.value === AUTH_USER_TYPE.ADMIN);
  const isParticipant: ComputedRef<boolean> = computed(() => userType.value === AUTH_USER_TYPE.PARTICIPANT);
  const isSuperAdmin: ComputedRef<boolean> = computed(() => userType.value === AUTH_USER_TYPE.SUPER_ADMIN);

  return {
    userType,
    isAdmin,
    isParticipant,
    isSuperAdmin,
  };
}
