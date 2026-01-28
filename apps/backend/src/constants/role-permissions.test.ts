import { describe, it, expect } from 'vitest';
import { rolesForPermission, RolePermissions } from './role-permissions';
import { Permissions } from './permissions';
import { UserRole } from '../enums/user-role.enum';

describe('role-permissions', () => {
  describe('rolesForPermission', () => {
    it('should return all roles with administrations.* for administrations.list', () => {
      const roles = rolesForPermission(Permissions.Administrations.LIST);

      // site_administrator and administrator have administrations.*
      // teacher and student have administrations.list directly
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).toContain(UserRole.TEACHER);
      expect(roles).toContain(UserRole.STUDENT);
      expect(roles).toHaveLength(4);
    });

    it('should return only roles with direct permission for administrations.create', () => {
      const roles = rolesForPermission(Permissions.Administrations.CREATE);

      // Only site_administrator and administrator have administrations.* (covers .create)
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).not.toContain(UserRole.TEACHER);
      expect(roles).not.toContain(UserRole.STUDENT);
      expect(roles).toHaveLength(2);
    });

    it('should handle wildcard matching for nested permissions', () => {
      const roles = rolesForPermission(Permissions.Reports.Score.READ);

      // site_administrator, administrator have reports.score.*
      // teacher has reports.score.read directly
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).toContain(UserRole.TEACHER);
      expect(roles).not.toContain(UserRole.STUDENT);
    });

    it('should throw error for unknown permission', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rolesForPermission('unknown.permission' as any);
      }).toThrow("No roles configured for permission 'unknown.permission'");
    });

    it('should return only site_administrator for testdata.create', () => {
      const roles = rolesForPermission(Permissions.TestData.CREATE);

      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toHaveLength(1);
    });

    it('should handle tasks.launch which is available to all roles', () => {
      const roles = rolesForPermission(Permissions.Tasks.LAUNCH);

      // site_administrator and administrator have tasks.*
      // teacher has tasks.launch directly
      // student has tasks.launch directly
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).toContain(UserRole.TEACHER);
      expect(roles).toContain(UserRole.STUDENT);
    });
  });

  describe('RolePermissions', () => {
    it('should define permissions for site_administrator', () => {
      expect(RolePermissions[UserRole.SITE_ADMINISTRATOR]).toBeDefined();
      expect(RolePermissions[UserRole.SITE_ADMINISTRATOR]).toContain(Permissions.Administrations.ALL);
    });

    it('should define permissions for administrator', () => {
      expect(RolePermissions[UserRole.ADMINISTRATOR]).toBeDefined();
      expect(RolePermissions[UserRole.ADMINISTRATOR]).toContain(Permissions.Administrations.ALL);
    });

    it('should define permissions for teacher', () => {
      expect(RolePermissions[UserRole.TEACHER]).toBeDefined();
      expect(RolePermissions[UserRole.TEACHER]).toContain(Permissions.Administrations.LIST);
    });

    it('should define permissions for student', () => {
      expect(RolePermissions[UserRole.STUDENT]).toBeDefined();
      expect(RolePermissions[UserRole.STUDENT]).toContain(Permissions.Administrations.LIST);
      expect(RolePermissions[UserRole.STUDENT]).toContain(Permissions.Tasks.LAUNCH);
    });
  });
});
