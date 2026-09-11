import { describe, it, expect } from 'vitest';
import { filterSupervisoryRoles } from './supervisory-roles.utils';

describe('supervisory-roles.utils', () => {
  describe('filterSupervisoryRoles', () => {
    it('returns only supervisory roles from input', () => {
      const roles = ['student', 'teacher', 'administrator'];
      const result = filterSupervisoryRoles(roles);

      expect(result).toContain('teacher');
      expect(result).toContain('administrator');
      expect(result).not.toContain('student');
    });

    it('returns empty array when no supervisory roles present', () => {
      const roles = ['student'];
      const result = filterSupervisoryRoles(roles);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      const result = filterSupervisoryRoles([]);

      expect(result).toEqual([]);
    });

    it('preserves all supervisory roles', () => {
      const roles = ['site_administrator', 'administrator', 'teacher'];
      const result = filterSupervisoryRoles(roles);

      expect(result).toHaveLength(3);
      expect(result).toContain('site_administrator');
      expect(result).toContain('administrator');
      expect(result).toContain('teacher');
    });
  });
});
