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

    it('should throw for administrations.create since no role has it explicitly', () => {
      expect(() => {
        rolesForPermission(Permissions.Administrations.CREATE);
      }).toThrow("No roles configured for permission 'administrations.create'");
    });

    it('should handle wildcard matching for nested permissions', () => {
      const roles = rolesForPermission(Permissions.Reports.Score.READ);

      // siteAdmin, admin, educator have reports.score.* (ALL)
      // caregiver has reports.score.read directly
      // student does not have reports access
      expect(roles).toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).toContain(UserRole.ADMINISTRATOR);
      expect(roles).toContain(UserRole.TEACHER);
      expect(roles).toContain(UserRole.GUARDIAN);
      expect(roles).not.toContain(UserRole.STUDENT);
      expect(roles).toHaveLength(12);
    });

    it('should throw error for unknown permission', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rolesForPermission('unknown.permission' as any);
      }).toThrow("No roles configured for permission 'unknown.permission'");
    });

    it('should throw for testdata.create since no role has it explicitly', () => {
      expect(() => {
        rolesForPermission(Permissions.TestData.CREATE);
      }).toThrow("No roles configured for permission 'testdata.create'");
    });

    it('should return only caregiver and student roles for tasks.launch', () => {
      const roles = rolesForPermission(Permissions.Tasks.LAUNCH);

      // Only caregiver and student tiers have tasks.launch
      expect(roles).toContain(UserRole.STUDENT);
      expect(roles).toContain(UserRole.GUARDIAN);
      expect(roles).toContain(UserRole.PARENT);
      expect(roles).toContain(UserRole.RELATIVE);
      expect(roles).not.toContain(UserRole.SITE_ADMINISTRATOR);
      expect(roles).not.toContain(UserRole.TEACHER);
      expect(roles).toHaveLength(4);
    });
  });

  describe('RolePermissions', () => {
    it('should define permissions for site_administrator', () => {
      expect(RolePermissions[UserRole.SITE_ADMINISTRATOR]).toBeDefined();
      expect(RolePermissions[UserRole.SITE_ADMINISTRATOR]).toContain(Permissions.Administrations.LIST);
      expect(RolePermissions[UserRole.SITE_ADMINISTRATOR]).toContain(Permissions.Administrations.READ);
    });

    it('should define permissions for administrator', () => {
      expect(RolePermissions[UserRole.ADMINISTRATOR]).toBeDefined();
      expect(RolePermissions[UserRole.ADMINISTRATOR]).toContain(Permissions.Administrations.LIST);
      expect(RolePermissions[UserRole.ADMINISTRATOR]).toContain(Permissions.Administrations.READ);
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
