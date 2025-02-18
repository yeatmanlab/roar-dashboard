import { PermissionsService, Permissions } from '@bdelab/roar-firekit';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

export function usePermissions() {
  const authStore = useAuthStore();
  const { accessToken } = storeToRefs(authStore);

  const userCan = (permission) => {
    return PermissionsService.canUser(accessToken.value, permission);
  };

  return {
    userCan,
    Permissions,
  };
}
