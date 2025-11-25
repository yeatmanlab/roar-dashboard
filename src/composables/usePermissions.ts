// composables/usePermissions.ts
import { ref, computed, onMounted, readonly, toValue } from 'vue';
import { storeToRefs } from 'pinia';
import { CacheService, PermissionDocument, PermissionService, type Resource, type Action, type Role, type UserRole as CoreUserRole, GroupSubResource, AdminSubResource, ROLES } from '@levante-framework/permissions-core';
import { useAuthStore } from '@/store/auth';
import { getAxiosInstance, getBaseDocumentPath, convertValues } from '@/helpers/query/utils';
import _mapValues from 'lodash/mapValues';

interface UserData {
  roles: CoreUserRole[];
}

// Session-level cache
const cache = new CacheService(300000); // 5 minutes
const permissionService = new PermissionService(cache);
const permissionsLoaded = ref(false);
let isLoadingPermissions = false;

export const usePermissions = () => {
  const authStore = useAuthStore();
  const { isAuthenticated } = authStore;
  const { firebaseUser, userData, shouldUsePermissions, currentSite } = storeToRefs(authStore);
  const user = computed(() => {
    if (!isAuthenticated() || !firebaseUser.value.adminFirebaseUser) return null;

    return {
      uid: firebaseUser.value.adminFirebaseUser.uid,
      email: firebaseUser.value.adminFirebaseUser.email ?? '',
      roles: JSON.parse(JSON.stringify((userData.value as UserData)?.roles ?? [])) as CoreUserRole[],
    };
  });

  const loadPermissions = async () => {
    if (permissionsLoaded.value || isLoadingPermissions) return;
    isLoadingPermissions = true;

    try {
      const axiosInstance = getAxiosInstance();
      const response = await axiosInstance.get(`${getBaseDocumentPath()}/system/permissions`);
      const rawData = response.data;
      const convertedData = _mapValues(rawData.fields, (value) => convertValues(value));
      const { success, errors } = permissionService.loadPermissions(convertedData as PermissionDocument);
      permissionsLoaded.value = true;

      if (!success) {
        console.error('Failed to load permissions:', errors);
      }
    } finally {
      isLoadingPermissions = false;
    }
  };

  onMounted(() => {
    if (permissionsLoaded.value) return;

    if (shouldUsePermissions.value && isAuthenticated()) {
      loadPermissions();
    }
  });

  const userRole = computed<Role | null>(() => {
    if (!shouldUsePermissions.value || !permissionsLoaded.value || !user.value || !currentSite.value) return null;

    return permissionService.getUserSiteRole(user.value, currentSite.value);
  });

  const can = (resource: Resource, action: Action, subResource?: GroupSubResource | AdminSubResource): boolean => {
    if (!shouldUsePermissions.value || !permissionsLoaded.value || !user.value || !currentSite.value) return false;

    return permissionService.canPerformSiteAction(
      user.value,
      currentSite.value,
      resource,
      action,
      subResource
    );
  };

  const canGlobal = (resource: Resource, action: Action, subResource?: GroupSubResource | AdminSubResource): boolean => {
    if (!shouldUsePermissions.value || !permissionsLoaded.value || !user.value) return false;

    return permissionService.canPerformGlobalAction(user.value, resource, action, subResource);
  };

  const hasMinimumRole = (role: Role): boolean => {
    if (!userRole.value) return false;

    return permissionService.hasMinimumRole(userRole.value, role);
  };

  const hasRole = (role: Role): boolean => hasMinimumRole(role);

  const permissions = computed(() => {
    if (!shouldUsePermissions.value || !permissionsLoaded.value) return {};

    const resources = ['groups', 'assignments', 'users', 'admins', 'tasks'] as Resource[];
    const actions = ['create', 'read', 'update', 'delete', 'exclude'] as Action[];

    const perms: Record<string, Record<string, boolean>> = {};

    resources.forEach(resource => {
      const resourcePerms: Record<string, boolean> = {};
      actions.forEach(action => {
        const actionKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
        resourcePerms[actionKey] = can(resource, action);
      });
      perms[resource] = resourcePerms;
    });

    return perms;
  });

  return {
    can,
    canGlobal,
    hasRole,
    hasMinimumRole,
    userRole,
    permissions,
    permissionsLoaded: readonly(permissionsLoaded),
  };
};
