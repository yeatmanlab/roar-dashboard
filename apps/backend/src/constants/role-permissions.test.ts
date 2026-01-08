import { describe, it, expect } from 'vitest';
import { rolesForPermission, RolePermissions } from './role-permissions';
import { Permissions } from './permissions';
import { USER_ROLE } from '../enums/user-role.enum';

describe('role-permissions', () => {
  describe('rolesForPermission', () => {
    it('should return all roles with administrations.* for administrations.list', () => {
      const roles = rolesForPermission(Permissions.Administrations.LIST);

      // site_administrator and administrator have administrations.*
      // teacher and student have administrations.list directly
      expect(roles).toContain(USER_ROLE.SITE_ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.TEACHER);
      expect(roles).toContain(USER_ROLE.STUDENT);
      expect(roles).toHaveLength(4);
    });

    it('should return only roles with direct permission for administrations.create', () => {
      const roles = rolesForPermission(Permissions.Administrations.CREATE);

      // Only site_administrator and administrator have administrations.* (covers .create)
      expect(roles).toContain(USER_ROLE.SITE_ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.ADMINISTRATOR);
      expect(roles).not.toContain(USER_ROLE.TEACHER);
      expect(roles).not.toContain(USER_ROLE.STUDENT);
      expect(roles).toHaveLength(2);
    });

    it('should handle wildcard matching for nested permissions', () => {
      const roles = rolesForPermission(Permissions.Reports.Score.READ);

      // site_administrator, administrator have reports.score.*
      // teacher has reports.score.read directly
      expect(roles).toContain(USER_ROLE.SITE_ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.TEACHER);
      expect(roles).not.toContain(USER_ROLE.STUDENT);
    });

    it('should return empty array for unknown permission', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roles = rolesForPermission('unknown.permission' as any);
      expect(roles).toEqual([]);
    });

    it('should return only site_administrator for testdata.create', () => {
      const roles = rolesForPermission(Permissions.TestData.CREATE);

      expect(roles).toContain(USER_ROLE.SITE_ADMINISTRATOR);
      expect(roles).toHaveLength(1);
    });

    it('should handle tasks.launch which is available to all roles', () => {
      const roles = rolesForPermission(Permissions.Tasks.LAUNCH);

      // site_administrator and administrator have tasks.*
      // teacher has tasks.launch directly
      // student has tasks.launch directly
      expect(roles).toContain(USER_ROLE.SITE_ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.ADMINISTRATOR);
      expect(roles).toContain(USER_ROLE.TEACHER);
      expect(roles).toContain(USER_ROLE.STUDENT);
    });
  });

  describe('RolePermissions', () => {
    it('should define permissions for site_administrator', () => {
      expect(RolePermissions[USER_ROLE.SITE_ADMINISTRATOR]).toBeDefined();
      expect(RolePermissions[USER_ROLE.SITE_ADMINISTRATOR]).toContain(Permissions.Administrations.ALL);
    });

    it('should define permissions for administrator', () => {
      expect(RolePermissions[USER_ROLE.ADMINISTRATOR]).toBeDefined();
      expect(RolePermissions[USER_ROLE.ADMINISTRATOR]).toContain(Permissions.Administrations.ALL);
    });

    it('should define permissions for teacher', () => {
      expect(RolePermissions[USER_ROLE.TEACHER]).toBeDefined();
      expect(RolePermissions[USER_ROLE.TEACHER]).toContain(Permissions.Administrations.LIST);
    });

    it('should define permissions for student', () => {
      expect(RolePermissions[USER_ROLE.STUDENT]).toBeDefined();
      expect(RolePermissions[USER_ROLE.STUDENT]).toContain(Permissions.Administrations.LIST);
      expect(RolePermissions[USER_ROLE.STUDENT]).toContain(Permissions.Tasks.LAUNCH);
    });
  });
});
