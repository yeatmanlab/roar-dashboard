import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

/**
 * Determine whether a user is able to take a specific action based on their role.
 *
 * This composable is to be called when a user attempts to perform an action that requires
 * a certain level of permission. The function will consider the user's role and additional
 * permissions, and return a boolean indicating whether the user has the required permission.
 */

const usePermissionsManager = () => {
  const authStore = useAuthStore();
  const { role } = storeToRefs(authStore);
  console.log('[PermissionsManager] Role:', role.value);

  const canUser = (permission) => {
    console.log('[PermissionsManager] Checking permission:', permission);
    // If permission is in list of unauthed permissions, return true.
    // Check for permission in the user's role.
    // Check for 'permission_group.*'
    // Finally, check for the permission in the user's additional permissions.
    // Else, return false.
    return false; // Replace with actual logic to check user permissions.
  };

  return { canUser };
};

export default usePermissionsManager;
