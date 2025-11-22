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

export const usePermissions = () => {
  const authStore = useAuthStore();
  const { isAuthenticated } = authStore;
  const { firebaseUser, userData, shouldUsePermissions, currentSite } = storeToRefs(authStore);

  // console.log('isAuthenticated: ', isAuthenticated);
  // console.log('firebaseUser: ', firebaseUser.adminFirebaseUser);

  const permissionsLoaded = ref(false);
  const user = computed(() => {
    if (!isAuthenticated() || !firebaseUser.value.adminFirebaseUser) return null;

    return {
      uid: firebaseUser.value.adminFirebaseUser.uid,
      email: firebaseUser.value.adminFirebaseUser.email ?? '',
      roles: JSON.parse(JSON.stringify((userData.value as UserData)?.roles ?? [])) as CoreUserRole[],
    };
  });

  // Load permissions from Firestore document
  const loadPermissions = async () => {
    const axiosInstance = getAxiosInstance();
    const response = await axiosInstance.get(`${getBaseDocumentPath()}/system/permissions`);

    // TODO: Implement real-time listener for permission changes
    // onSnapshot(permissionsRef, (doc) => {
    //   if (doc.exists()) {
    //     const data = response.data;
    //     PermissionService.loadPermissions(data.matrix as PermissionMatrix);
    //     permissionsLoaded.value = true;
    //   } else {
    //     console.error('Permissions document not found');
    //   }
    // }, (error) => {
    //   console.error('Failed to load permissions:', error);
    // });

    const rawData = response.data;
    
    // Convert Firestore field values to JavaScript values
    const convertedData = _mapValues(rawData.fields, (value) => convertValues(value));
    

    const {success, errors } = permissionService.loadPermissions(convertedData as PermissionDocument);

    if (!success) {
      console.error('Failed to load permissions:', errors);
    }
    permissionsLoaded.value = true;
  };

  // Load permissions when component mounts and user is authenticated
  onMounted(() => {
    if (shouldUsePermissions.value && isAuthenticated()) {
      loadPermissions();
    }
  });

  const userRole = computed<Role | null>(() => {
    if (!shouldUsePermissions || !permissionsLoaded.value || !user.value || !currentSite) return null;

    return permissionService.getUserSiteRole(user.value, currentSite);
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
