import { describe, it, expect } from 'vitest';
import {
  BASE_ROLE_OPTIONS,
  PLATFORM_ADMIN_ROLE_OPTION,
  ROLE_TO_USER_TYPE,
  getAssignableRoleOptions,
  buildCreateUserPayload,
} from './createAdministratorForm';

describe('createAdministratorForm helpers', () => {
  describe('getAssignableRoleOptions', () => {
    it('offers the base roles (no platform_admin) to non-super-admins', () => {
      const options = getAssignableRoleOptions(false);
      const values = options.map((o) => o.value);

      expect(values).toEqual(BASE_ROLE_OPTIONS.map((o) => o.value));
      expect(values).not.toContain('platform_admin');
    });

    it('additionally offers platform_admin to super-admins', () => {
      const options = getAssignableRoleOptions(true);
      const values = options.map((o) => o.value);

      expect(values).toContain('platform_admin');
      expect(options[options.length - 1]).toEqual(PLATFORM_ADMIN_ROLE_OPTION);
    });

    it('never offers a super-admin role to anyone (super admin is not a membership role)', () => {
      const everyValue = [...getAssignableRoleOptions(false), ...getAssignableRoleOptions(true)].map((o) => o.value);

      expect(everyValue).not.toContain('super_admin');
      expect(everyValue).not.toContain('superadmin');
    });

    it('does not mutate BASE_ROLE_OPTIONS when appending platform_admin', () => {
      const before = BASE_ROLE_OPTIONS.length;
      getAssignableRoleOptions(true);
      expect(BASE_ROLE_OPTIONS).toHaveLength(before);
    });
  });

  describe('ROLE_TO_USER_TYPE', () => {
    it('maps every assignable role to a valid userType', () => {
      const validUserTypes = new Set(['student', 'educator', 'caregiver', 'admin']);
      const everyRole = getAssignableRoleOptions(true).map((o) => o.value);

      for (const role of everyRole) {
        expect(ROLE_TO_USER_TYPE[role], `role ${role} is unmapped`).toBeDefined();
        expect(validUserTypes.has(ROLE_TO_USER_TYPE[role])).toBe(true);
      }
    });

    it('tiers admin roles as admin and staff roles as educator (mirrors backend role-permissions)', () => {
      expect(ROLE_TO_USER_TYPE.administrator).toBe('admin');
      expect(ROLE_TO_USER_TYPE.district_administrator).toBe('admin');
      expect(ROLE_TO_USER_TYPE.site_administrator).toBe('admin');
      expect(ROLE_TO_USER_TYPE.system_administrator).toBe('admin');
      expect(ROLE_TO_USER_TYPE.platform_admin).toBe('admin');
      expect(ROLE_TO_USER_TYPE.principal).toBe('educator');
      expect(ROLE_TO_USER_TYPE.teacher).toBe('educator');
      expect(ROLE_TO_USER_TYPE.aide).toBe('educator');
      expect(ROLE_TO_USER_TYPE.counselor).toBe('educator');
      expect(ROLE_TO_USER_TYPE.proctor).toBe('educator');
    });
  });

  describe('buildCreateUserPayload', () => {
    const baseState = {
      firstName: 'Ada',
      middleName: '',
      lastName: 'Lovelace',
      email: 'ada@example.edu',
      password: 'supersecret',
      role: 'teacher',
      districts: [],
      schools: [{ id: 'school-1' }],
      classes: [{ id: 'class-1' }, { id: 'class-2' }],
      groups: [],
    };

    it('applies the chosen role to every selected org of every type', () => {
      const body = buildCreateUserPayload(baseState);

      expect(body.memberships).toEqual([
        { entityType: 'school', entityId: 'school-1', role: 'teacher' },
        { entityType: 'class', entityId: 'class-1', role: 'teacher' },
        { entityType: 'class', entityId: 'class-2', role: 'teacher' },
      ]);
    });

    it('derives userType from the chosen role', () => {
      expect(buildCreateUserPayload(baseState).userType).toBe('educator');
      expect(buildCreateUserPayload({ ...baseState, role: 'administrator' }).userType).toBe('admin');
    });

    it('omits the middle name when blank and includes it when present', () => {
      expect(buildCreateUserPayload(baseState).name).toEqual({ first: 'Ada', last: 'Lovelace' });
      expect(buildCreateUserPayload({ ...baseState, middleName: 'B' }).name).toEqual({
        first: 'Ada',
        last: 'Lovelace',
        middle: 'B',
      });
    });

    it('never includes a families membership', () => {
      const body = buildCreateUserPayload({
        ...baseState,
        districts: [{ id: 'd-1' }],
        groups: [{ id: 'g-1' }],
      });

      expect(body.memberships.some((m) => m.entityType === 'family')).toBe(false);
      expect(body.memberships.map((m) => m.entityType)).toEqual(['district', 'school', 'class', 'class', 'group']);
    });

    it('passes email and password straight through', () => {
      const body = buildCreateUserPayload(baseState);
      expect(body.email).toBe('ada@example.edu');
      expect(body.password).toBe('supersecret');
    });
  });
});
