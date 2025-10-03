// composables/usePermissions.ts
import { ref, computed, onMounted, readonly, toValue } from 'vue';
import { CacheService, PermissionDocument, PermissionService, type Resource, type Action, type Role, type UserRole as CoreUserRole, GroupSubResource, AdminSubResource } from '@levante-framework/permissions-core';
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
  const { isAuthenticated, firebaseUser, userData, shouldUsePermissions } = authStore;

  // console.log('isAuthenticated: ', isAuthenticated);
  // console.log('firebaseUser: ', firebaseUser.adminFirebaseUser);

  const permissionsLoaded = ref(false);
  const currentSite = toValue(authStore.currentSite);
  const user = computed(() => {
    if (!isAuthenticated() || !firebaseUser.adminFirebaseUser) return null;

    return {
      uid: firebaseUser.adminFirebaseUser.uid,
      email: firebaseUser.adminFirebaseUser.email ?? '',
      roles: JSON.parse(JSON.stringify((userData as UserData)?.roles ?? [])) as CoreUserRole[],
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
    if (shouldUsePermissions && isAuthenticated()) {
      loadPermissions();
    }
  });

  const can = (resource: Resource, action: Action, subResource?: GroupSubResource | AdminSubResource): boolean => {
    if (!shouldUsePermissions || !permissionsLoaded.value || !user.value || !currentSite) return false;

    return permissionService.canPerformSiteAction(
      user.value,
      currentSite,
      resource,
      action,
      subResource
    );
  };

  const canGlobal = (resource: Resource, action: Action, subResource?: GroupSubResource | AdminSubResource): boolean => {
    if (!shouldUsePermissions || !permissionsLoaded.value || !user.value) return false;

    return permissionService.canPerformGlobalAction(user.value, resource, action, subResource);
  };

  const hasRole = (role: Role): boolean => {
    if (!shouldUsePermissions || !permissionsLoaded.value || !user.value || !currentSite) return false;

    const userRole = permissionService.getUserSiteRole(
      user.value,
      currentSite
    );

    if (!userRole) return false;

    return permissionService.hasMinimumRole(userRole, role);
  };

  const permissions = computed(() => {
    if (!shouldUsePermissions || !permissionsLoaded.value) return {};

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
    permissions,
    permissionsLoaded: readonly(permissionsLoaded),
  };
};
