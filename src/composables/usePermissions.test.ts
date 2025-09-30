import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { usePermissions } from './usePermissions';

// Mock the permissions-core package
vi.mock('@levante-framework/permissions-core', () => ({
  CacheService: vi.fn(() => ({})),
  PermissionService: vi.fn(() => ({
    loadPermissions: vi.fn(() => ({ success: true, errors: [] })),
    canPerformSiteAction: vi.fn(() => false),
    canPerformGlobalAction: vi.fn(() => false),
    getUserSiteRole: vi.fn(() => null),
    hasMinimumRole: vi.fn(() => false),
  })),
}));

// Mock the query utils
vi.mock('@/helpers/query/utils', () => ({
  getAxiosInstance: vi.fn(() => ({
    get: vi.fn(() =>
      Promise.resolve({
        data: {
          fields: {
            matrix: { mapValue: { fields: {} } },
            lastUpdated: { timestampValue: '2023-01-01T00:00:00Z' },
            updatedAt: { timestampValue: '2023-01-01T00:00:00Z' },
          },
        },
      }),
    ),
  })),
  getBaseDocumentPath: vi.fn(() => '/test-path'),
  convertValues: vi.fn((value) => value),
}));

// Mock lodash mapValues
vi.mock('lodash/mapValues', () => ({
  default: vi.fn((obj, fn) => {
    const result = {};
    Object.keys(obj).forEach((key) => {
      result[key] = fn(obj[key]);
    });
    return result;
  }),
}));

describe('usePermissions', () => {
  let piniaInstance;
  let mockPermissionService;
  let mockAuthStore;

  beforeEach(async () => {
    piniaInstance = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
    });

    // Reset the mocked PermissionService
    mockPermissionService = {
      loadPermissions: vi.fn(() => ({ success: true, errors: [] })),
      canPerformSiteAction: vi.fn(() => false),
      canPerformGlobalAction: vi.fn(() => false),
      getUserSiteRole: vi.fn(() => null),
      hasMinimumRole: vi.fn(() => false),
    };

    // Get the mocked PermissionService constructor
    const { PermissionService } = await import('@levante-framework/permissions-core');
    vi.mocked(PermissionService).mockReturnValue(mockPermissionService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when user is not authenticated', () => {
    it('should return false for all permission checks', () => {
      withSetup(
        () => {
          const authStore = useAuthStore(piniaInstance);
          authStore.isAuthenticated = vi.fn(() => false);
          authStore.shouldUsePermissions = true;
          authStore.firebaseUser = { adminFirebaseUser: null };
          authStore.userData = null;
          authStore.currentSite = 'test-site';

          const { can, canGlobal, hasRole, permissions } = usePermissions();

          expect(can('groups', 'read')).toBe(false);
          expect(canGlobal('users', 'create')).toBe(false);
          expect(hasRole('admin')).toBe(false);
          expect(permissions.value).toEqual({});
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });
  });

  describe('when shouldUsePermissions is false', () => {
    it('should return false for all permission checks', () => {
      withSetup(
        () => {
          const authStore = useAuthStore(piniaInstance);
          authStore.isAuthenticated = vi.fn(() => true);
          authStore.shouldUsePermissions = false;
          authStore.firebaseUser = {
            adminFirebaseUser: {
              uid: 'test-uid',
              email: 'test@example.com',
            },
          };
          authStore.userData = { roles: [] };
          authStore.currentSite = 'test-site';

          const { can, canGlobal, hasRole, permissions } = usePermissions();

          expect(can('groups', 'read')).toBe(false);
          expect(canGlobal('users', 'create')).toBe(false);
          expect(hasRole('admin')).toBe(false);
          expect(permissions.value).toEqual({});
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });
  });

  describe('when user is authenticated and permissions are enabled', () => {
    beforeEach(() => {
      mockAuthStore = {
        isAuthenticated: vi.fn(() => true),
        shouldUsePermissions: true,
        firebaseUser: {
          adminFirebaseUser: {
            uid: 'test-uid',
            email: 'test@example.com',
          },
        },
        userData: {
          roles: [{ siteId: 'test-site', role: 'admin', siteName: 'Test Site' }],
        },
        currentSite: 'test-site',
      };
    });

    it('should initialize permissions loading state correctly', () => {
      withSetup(
        () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { permissionsLoaded } = usePermissions();

          expect(permissionsLoaded.value).toBe(false);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should call permission service methods for site actions', async () => {
      mockPermissionService.canPerformSiteAction.mockReturnValue(true);

      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { can } = usePermissions();

          // Wait for permissions to load (onMounted hook runs automatically)
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          const result = can('groups', 'read');

          expect(mockPermissionService.canPerformSiteAction).toHaveBeenCalledWith(
            {
              uid: 'test-uid',
              email: 'test@example.com',
              roles: [{ siteId: 'test-site', role: 'admin', siteName: 'Test Site' }],
            },
            'test-site',
            'groups',
            'read',
          );
          expect(result).toBe(true);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should call permission service methods for global actions', async () => {
      mockPermissionService.canPerformGlobalAction.mockReturnValue(true);

      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { canGlobal } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          const result = canGlobal('users', 'create');

          expect(mockPermissionService.canPerformGlobalAction).toHaveBeenCalledWith(
            {
              uid: 'test-uid',
              email: 'test@example.com',
              roles: [{ siteId: 'test-site', role: 'admin', siteName: 'Test Site' }],
            },
            'users',
            'create',
          );
          expect(result).toBe(true);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should check user roles correctly', async () => {
      mockPermissionService.getUserSiteRole.mockReturnValue('admin');
      mockPermissionService.hasMinimumRole.mockReturnValue(true);

      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { hasRole } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          const result = hasRole('admin');

          expect(mockPermissionService.getUserSiteRole).toHaveBeenCalledWith(
            {
              uid: 'test-uid',
              email: 'test@example.com',
              roles: [{ siteId: 'test-site', role: 'admin', siteName: 'Test Site' }],
            },
            'test-site',
          );
          expect(mockPermissionService.hasMinimumRole).toHaveBeenCalledWith('admin', 'admin');
          expect(result).toBe(true);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should return false for hasRole when user has no site role', async () => {
      mockPermissionService.getUserSiteRole.mockReturnValue(null);

      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { hasRole } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          const result = hasRole('admin');

          expect(result).toBe(false);
          expect(mockPermissionService.hasMinimumRole).not.toHaveBeenCalled();
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should compute permissions object correctly when permissions are loaded', async () => {
      mockPermissionService.canPerformSiteAction.mockImplementation((user, site, resource, action) => {
        return resource === 'groups' && action === 'read';
      });

      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { permissions } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();
          await nextTick(); // Wait for computed to update

          const expectedPermissions = {
            groups: {
              canCreate: false,
              canRead: true,
              canUpdate: false,
              canDelete: false,
              canExclude: false,
            },
            assignments: {
              canCreate: false,
              canRead: false,
              canUpdate: false,
              canDelete: false,
              canExclude: false,
            },
            users: {
              canCreate: false,
              canRead: false,
              canUpdate: false,
              canDelete: false,
              canExclude: false,
            },
            admins: {
              canCreate: false,
              canRead: false,
              canUpdate: false,
              canDelete: false,
              canExclude: false,
            },
            tasks: {
              canCreate: false,
              canRead: false,
              canUpdate: false,
              canDelete: false,
              canExclude: false,
            },
          };

          expect(permissions.value).toEqual(expectedPermissions);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should return empty permissions object when permissions are not loaded', async () => {
      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          Object.assign(authStore, mockAuthStore);

          const { permissions, permissionsLoaded } = usePermissions();

          expect(permissionsLoaded.value).toBe(false);
          expect(permissions.value).toEqual({});
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });
  });

  describe('when currentSite is missing', () => {
    it('should return false for site-specific permission checks', async () => {
      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          authStore.isAuthenticated = vi.fn(() => true);
          authStore.shouldUsePermissions = true;
          authStore.firebaseUser = {
            adminFirebaseUser: {
              uid: 'test-uid',
              email: 'test@example.com',
            },
          };
          authStore.userData = { roles: [] };
          authStore.currentSite = null;

          const { can, hasRole } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          expect(can('groups', 'read')).toBe(false);
          expect(hasRole('admin')).toBe(false);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });

    it('should still work for global permission checks', async () => {
      mockPermissionService.canPerformGlobalAction.mockReturnValue(true);

      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          authStore.isAuthenticated = vi.fn(() => true);
          authStore.shouldUsePermissions = true;
          authStore.firebaseUser = {
            adminFirebaseUser: {
              uid: 'test-uid',
              email: 'test@example.com',
            },
          };
          authStore.userData = { roles: [] };
          authStore.currentSite = null;

          const { canGlobal } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          const result = canGlobal('users', 'create');

          expect(result).toBe(true);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });
  });

  describe('when user data is missing', () => {
    it('should return false for all permission checks', async () => {
      await withSetup(
        async () => {
          const authStore = useAuthStore(piniaInstance);
          authStore.isAuthenticated = vi.fn(() => true);
          authStore.shouldUsePermissions = true;
          authStore.firebaseUser = {
            adminFirebaseUser: {
              uid: 'test-uid',
              email: 'test@example.com',
            },
          };
          authStore.userData = null;
          authStore.currentSite = 'test-site';

          const { can, canGlobal, hasRole } = usePermissions();

          // Wait for permissions to load
          await nextTick();
          // Wait for all pending promises including loadPermissions
          await flushPromises();
          // Additional tick for reactive updates
          await nextTick();

          expect(can('groups', 'read')).toBe(false);
          expect(canGlobal('users', 'create')).toBe(false);
          expect(hasRole('admin')).toBe(false);
        },
        {
          plugins: [[piniaInstance]],
        },
      );
    });
  });
});
