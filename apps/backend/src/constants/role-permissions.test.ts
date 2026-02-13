import { describe, it, expect } from 'vitest';
import { rolesForPermission, RolePermissions } from './role-permissions';
import { Permissions } from './permissions';
import { UserRole } from '../enums/user-role.enum';
import { userRoleEnum } from '../db/schema/enums';

describe('role-permissions', () => {
  describe('rolesForPermission', () => {
    it('should return all roles with administrations.* or administrations.list for administrations.list', () => {
      const roles = rolesForPermission(Permissions.Administrations.LIST);

      // All 13 roles have either administrations.* or administrations.list
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).toContain(UserRole.TEACHER);
      expect(roles).toContain(UserRole.STUDENT);
      expect(roles).toHaveLength(13);
    });

    it('should return only roles with administrations.* for administrations.create', () => {
      const roles = rolesForPermission(Permissions.Administrations.CREATE);

      // Only system_administrator, site_administrator, district_administrator, administrator have administrations.*
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).not.toContain(UserRole.TEACHER);
      expect(roles).not.toContain(UserRole.STUDENT);
      expect(roles).toHaveLength(4);
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

    it('should return only top-tier admins for testdata.create', () => {
      const roles = rolesForPermission(Permissions.TestData.CREATE);

      expect(roles).toContain(UserRole.SYSTEM_ADMINISTRATOR);
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toHaveLength(2);
    });

    it('should return all roles for tasks.launch', () => {
      const roles = rolesForPermission(Permissions.Tasks.LAUNCH);

      // All 13 roles have either tasks.* or tasks.launch
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).toContain(UserRole.TEACHER);
      expect(roles).toContain(UserRole.STUDENT);
      expect(roles).toHaveLength(13);
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

  describe('RolePermissions completeness', () => {
    it('should have a permission entry for every value in userRoleEnum', () => {
      const mappedRoles = Object.keys(RolePermissions).sort();
      const enumRoles = [...userRoleEnum.enumValues].sort();

      expect(mappedRoles).toEqual(enumRoles);
    });

    it('should not have any empty permission arrays', () => {
      for (const [role, permissions] of Object.entries(RolePermissions)) {
        expect(permissions.length, `${role} should have at least one permission`).toBeGreaterThan(0);
      }
    });
  });
});
