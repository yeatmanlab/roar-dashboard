/**
 * Determine whether a user is able to take a specific action based on their role.
 *
 * Thsi composable is to be called when a user attempts to perform an action that requires
 * a certain level of permission. The function will consider the user's role and additional
 * permissions, and return a boolean indicating whether the user has the required permission.
 */

const usePermissionsManager = () => {
  const userRole = computed(() => authStore.state.user.role);
  const userPermissions = computed(() => authStore.state.user.permissions);

  const hasPermission = (permission) => {
    if (!userRole.value) return false;
    if (userPermissions.value.includes(permission)) return true;

    // Check if the user is a super admin
    if (userRole.value === 'SUPER_ADMIN') return true;

    // Check if the user has the required role-based permission
    const rolePermissions = roles.find((role) => role.id === userRole.value)?.permissions;
    if (rolePermissions && rolePermissions.includes(permission)) return true;

    return false;
  };

  return { hasPermission };
};
