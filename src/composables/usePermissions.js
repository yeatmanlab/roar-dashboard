import { PermissionsService, Permissions } from '@bdelab/roar-firekit';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

export function usePermissions() {
  const userCan = (permission) => {
    const authStore = useAuthStore();
    const { accessToken } = storeToRefs(authStore);
    return PermissionsService.canUser(accessToken.value, permission);
  };

  return {
    userCan,
    Permissions,
  };
}
