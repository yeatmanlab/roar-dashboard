import { PermissionsService, Permissions, UserRoles } from '@bdelab/roar-firekit';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import * as Sentry from '@sentry/vue';

export function usePermissions() {
  const userCan = (permission) => {
    if (permission === undefined || permission === null) {
      Sentry.captureException(new Error('Tried to evaluate a permission that is undefined or null.'));
      return false;
    }

    // Note: Creating a new instance of authStore on every invokation of userCan is suboptimal.
    // Moving the following two lines outside the function will prevent the app from loading.
    // Fixing this issue is a TODO.
    const authStore = useAuthStore();
    const { accessToken } = storeToRefs(authStore);

    // If there's no access token yet, we cannot evaluate permissions.
    // Return false to prevent permission checks before authentication is complete.
    if (!accessToken.value) {
      return false;
    }

    return PermissionsService.canUser(accessToken.value, permission);
  };

  return {
    userCan,
    Permissions,
    UserRoles,
  };
}
