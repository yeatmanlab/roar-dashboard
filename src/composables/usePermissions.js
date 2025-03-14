import { PermissionsService, Permissions, UserRoles } from '@bdelab/roar-firekit';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

export function usePermissions() {
  const userCan = (permission) => {
    // Note: Creating a new instance of authStore on every invokation of userCan is suboptimal.
    // Moving the following two lines outside the function will prevent the app from loading.
    // Fixing this issue is a TODO.
    const authStore = useAuthStore();
    const { accessToken } = storeToRefs(authStore);
    return PermissionsService?.canUser(accessToken.value, permission);
  };

  return {
    userCan,
    Permissions,
    UserRoles,
  };
}
