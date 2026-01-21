import { describe, it, expect } from 'vitest';
import { SUPERVISORY_ROLES, SUPERVISED_ROLES } from './role-classifications';
import { userRoleEnum } from '../db/schema/enums';

describe('role-classifications', () => {
  const allRoles = userRoleEnum.enumValues;

  describe('SUPERVISORY_ROLES', () => {
    it('should include administrator roles', () => {
      expect(SUPERVISORY_ROLES).toContain('administrator');
      expect(SUPERVISORY_ROLES).toContain('site_administrator');
      expect(SUPERVISORY_ROLES).toContain('district_administrator');
      expect(SUPERVISORY_ROLES).toContain('system_administrator');
    });

    it('should include educator roles', () => {
      expect(SUPERVISORY_ROLES).toContain('teacher');
      expect(SUPERVISORY_ROLES).toContain('aide');
      expect(SUPERVISORY_ROLES).toContain('counselor');
      expect(SUPERVISORY_ROLES).toContain('principal');
      expect(SUPERVISORY_ROLES).toContain('proctor');
    });

    it('should not include student or family roles', () => {
      expect(SUPERVISORY_ROLES).not.toContain('student');
      expect(SUPERVISORY_ROLES).not.toContain('guardian');
      expect(SUPERVISORY_ROLES).not.toContain('parent');
      expect(SUPERVISORY_ROLES).not.toContain('relative');
    });

    it('should only contain valid roles from userRoleEnum', () => {
      for (const role of SUPERVISORY_ROLES) {
        expect(allRoles).toContain(role);
      }
    });
  });

  describe('SUPERVISED_ROLES', () => {
    it('should include student role', () => {
      expect(SUPERVISED_ROLES).toContain('student');
    });

    it('should include family roles', () => {
      expect(SUPERVISED_ROLES).toContain('guardian');
      expect(SUPERVISED_ROLES).toContain('parent');
      expect(SUPERVISED_ROLES).toContain('relative');
    });

    it('should not include any administrator or educator roles', () => {
      expect(SUPERVISED_ROLES).not.toContain('administrator');
      expect(SUPERVISED_ROLES).not.toContain('teacher');
      expect(SUPERVISED_ROLES).not.toContain('principal');
    });

    it('should only contain valid roles from userRoleEnum', () => {
      for (const role of SUPERVISED_ROLES) {
        expect(allRoles).toContain(role);
      }
    });
  });

  describe('role classification completeness', () => {
    it('should have no overlap between supervisory and supervised roles', () => {
      const overlap = SUPERVISORY_ROLES.filter((role) => SUPERVISED_ROLES.includes(role));
      expect(overlap).toHaveLength(0);
    });

    it('should cover all roles in userRoleEnum', () => {
      const classifiedRoles = [...SUPERVISORY_ROLES, ...SUPERVISED_ROLES];
      for (const role of allRoles) {
        expect(classifiedRoles).toContain(role);
      }
    });
  });
});
