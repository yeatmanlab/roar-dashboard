/**
 * Integration tests for ClassRepository.
 *
 * Tests custom methods (getById, getAuthorizedById) against the
 * real database with the base fixture's org hierarchy and classes.
 *
 * ## BaseFixture Structure Used
 *
 * ```
 * district (District A)
 * ├── schoolA
 * │   └── classInSchoolA
 * └── schoolB
 *     └── classInSchoolB
 *
 * districtB (District B - separate branch)
 * └── schoolInDistrictB
 *     └── classInDistrictB
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { ClassRepository } from './class.repository';
import { CoreDbClient } from '../test-support/db';
import { UserRole } from '../enums/user-role.enum';

describe('ClassRepository', () => {
  let repository: ClassRepository;

  beforeAll(() => {
    repository = new ClassRepository(CoreDbClient);
  });

  describe('getById (inherited)', () => {
    it('returns class when it exists', async () => {
      const result = await repository.getById({ id: baseFixture.classInSchoolA.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.classInSchoolA.id);
    });

    it('returns null for nonexistent class', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });
  });

  describe('getAuthorizedById', () => {
    describe('returns class when user has access', () => {
      it('district admin can access class in their district', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('school teacher can access class in their school', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('class student can access their class', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.classAStudent.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolA.id);
      });
    });

    describe('supervisory descendant access (district → school → class)', () => {
      it('district admin can access all classes in all schools under their district', async () => {
        // District admin should see classInSchoolA (under schoolA in district)
        const resultA = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
        );
        expect(resultA).not.toBeNull();
        expect(resultA!.id).toBe(baseFixture.classInSchoolA.id);

        // District admin should also see classInSchoolB (under schoolB in same district)
        const resultB = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolB.id,
        );
        expect(resultB).not.toBeNull();
        expect(resultB!.id).toBe(baseFixture.classInSchoolB.id);
      });

      it('district admin cannot access classes in a different district', async () => {
        // District admin (district A) should NOT see classInDistrictB
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInDistrictB.id,
        );
        expect(result).toBeNull();
      });

      it('district B admin can access classes only in their district', async () => {
        // District B admin should see classInDistrictB
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInDistrictB.id,
        );
        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInDistrictB.id);
      });

      it('multi-assigned user can access classes via district membership', async () => {
        // multiAssignedUser has ADMINISTRATOR at district and TEACHER at schoolA
        // Should be able to access classInSchoolB via district membership
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.multiAssignedUser.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolB.id,
        );
        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolB.id);
      });
    });

    describe('returns null when user lacks access', () => {
      it('district B admin cannot access class in district A', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });

      it('school A teacher cannot access class in school B', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolB.id,
        );

        expect(result).toBeNull();
      });

      it('unassigned user cannot access any class', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.unassignedUser.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });
    });

    it('returns null for nonexistent class ID', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    describe('enrollment date boundaries', () => {
      it('excludes user with expired enrollment', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.expiredEnrollmentStudent.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });

      it('excludes user with future enrollment', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.futureEnrollmentStudent.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });
    });
  });
});
