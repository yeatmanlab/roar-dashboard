/**
 * Integration tests for ReportRepository.
 *
 * Tests the reporting-specific data access methods against the real database
 * with the base fixture's org hierarchy, users, and administrations.
 *
 * Note: FDW runs table is a foreign table to a separate database and won't
 * have data in integration tests. Run-related assertions verify empty results
 * and correct SQL structure rather than run data content.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { ReportRepository } from './report.repository';

describe('ReportRepository', () => {
  let repository: ReportRepository;

  beforeAll(() => {
    repository = new ReportRepository();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTaskMetadata
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTaskMetadata', () => {
    it('returns task metadata for an administration with task variants', async () => {
      const result = await repository.getTaskMetadata(baseFixture.administrationAssignedToDistrict.id);

      expect(result).toHaveLength(4);

      // Verify ordering by orderIndex
      expect(result[0]!.orderIndex).toBe(0);
      expect(result[1]!.orderIndex).toBe(1);
      expect(result[2]!.orderIndex).toBe(2);
      expect(result[3]!.orderIndex).toBe(3);

      // Verify all fields are populated
      for (const meta of result) {
        expect(meta.taskId).toBe(baseFixture.task.id);
        expect(meta.taskSlug).toBeTruthy();
        expect(meta.taskName).toBeTruthy();
        expect(meta.taskVariantId).toBeTruthy();
      }

      // Verify correct variant IDs are returned
      const variantIds = result.map((r) => r.taskVariantId);
      expect(variantIds).toContain(baseFixture.variantForAllGrades.id);
      expect(variantIds).toContain(baseFixture.variantForGrade5.id);
      expect(variantIds).toContain(baseFixture.variantForGrade3.id);
      expect(variantIds).toContain(baseFixture.variantOptionalForEll.id);
    });

    it('returns empty array for an administration with no task variants', async () => {
      // administrationAssignedToSchoolA has no task variants assigned in the fixture
      const result = await repository.getTaskMetadata(baseFixture.administrationAssignedToSchoolA.id);

      expect(result).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isScopeAssignedToAdministration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isScopeAssignedToAdministration', () => {
    it('returns true for district scope when district is assigned', async () => {
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToDistrict.id, {
        scopeType: 'district',
        scopeId: baseFixture.district.id,
      });

      expect(result).toBe(true);
    });

    it('returns true for school scope when school is assigned', async () => {
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToSchoolA.id, {
        scopeType: 'school',
        scopeId: baseFixture.schoolA.id,
      });

      expect(result).toBe(true);
    });

    it('returns true for class scope when class is assigned', async () => {
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToClassA.id, {
        scopeType: 'class',
        scopeId: baseFixture.classInSchoolA.id,
      });

      expect(result).toBe(true);
    });

    it('returns true for group scope when group is assigned', async () => {
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToGroup.id, {
        scopeType: 'group',
        scopeId: baseFixture.group.id,
      });

      expect(result).toBe(true);
    });

    it('returns false for a scope entity not assigned to the administration', async () => {
      // schoolB is not assigned to administrationAssignedToSchoolA
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToSchoolA.id, {
        scopeType: 'school',
        scopeId: baseFixture.schoolB.id,
      });

      expect(result).toBe(false);
    });

    it('returns true for district scope with class-only assignment via ltree descendant', async () => {
      // administrationAssignedToClassA is assigned to classInSchoolA (not the district directly).
      // The district should still be a valid scope because classInSchoolA.orgPath is a
      // descendant of district.path — the ltree <@ operator catches this.
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToClassA.id, {
        scopeType: 'district',
        scopeId: baseFixture.district.id,
      });

      expect(result).toBe(true);
    });

    it('returns true for class scope when parent org is assigned to administration', async () => {
      // administrationAssignedToDistrict is assigned to the district org.
      // classInSchoolA should be a valid scope because the class's school is a descendant
      // of the assigned district.
      const result = await repository.isScopeAssignedToAdministration(baseFixture.administrationAssignedToDistrict.id, {
        scopeType: 'class',
        scopeId: baseFixture.classInSchoolA.id,
      });

      expect(result).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getUserRolesAtOrAboveScope
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getUserRolesAtOrAboveScope', () => {
    it('returns roles for district admin at district scope', async () => {
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.districtAdmin.id, {
        scopeType: 'district',
        scopeId: baseFixture.district.id,
      });

      expect(roles).toContain('administrator');
      expect(roles.length).toBeGreaterThanOrEqual(1);
    });

    it('returns roles for school teacher at school scope', async () => {
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.schoolATeacher.id, {
        scopeType: 'school',
        scopeId: baseFixture.schoolA.id,
      });

      expect(roles).toContain('teacher');
      expect(roles.length).toBeGreaterThanOrEqual(1);
    });

    it('returns district admin roles when checking school scope (ancestor role)', async () => {
      // districtAdmin has administrator role at district level.
      // When checking school scope, the ancestor query (school path <@ district path)
      // should find the district-level role.
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.districtAdmin.id, {
        scopeType: 'school',
        scopeId: baseFixture.schoolA.id,
      });

      expect(roles).toContain('administrator');
    });

    it('returns class teacher roles at class scope', async () => {
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.classATeacher.id, {
        scopeType: 'class',
        scopeId: baseFixture.classInSchoolA.id,
      });

      expect(roles).toContain('teacher');
    });

    it('returns district admin roles when checking class scope (ancestor role)', async () => {
      // districtAdmin's org role should be found via the class's orgPath ancestor lookup
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.districtAdmin.id, {
        scopeType: 'class',
        scopeId: baseFixture.classInSchoolA.id,
      });

      expect(roles).toContain('administrator');
    });

    it('returns group student roles at group scope', async () => {
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.groupStudent.id, {
        scopeType: 'group',
        scopeId: baseFixture.group.id,
      });

      expect(roles).toContain('student');
    });

    it('returns empty array for unassigned user', async () => {
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.unassignedUser.id, {
        scopeType: 'district',
        scopeId: baseFixture.district.id,
      });

      expect(roles).toHaveLength(0);
    });

    it('returns empty array for user in a different district', async () => {
      // districtBAdmin is at districtB, not at district
      const roles = await repository.getUserRolesAtOrAboveScope(baseFixture.districtBAdmin.id, {
        scopeType: 'district',
        scopeId: baseFixture.district.id,
      });

      expect(roles).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getProgressStudents
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getProgressStudents', () => {
    it('returns paginated students for district scope', async () => {
      const taskVariantIds = [
        baseFixture.variantForAllGrades.id,
        baseFixture.variantForGrade5.id,
        baseFixture.variantForGrade3.id,
        baseFixture.variantOptionalForEll.id,
      ];

      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        taskVariantIds,
        { page: 1, perPage: 100 },
      );

      // District scope should include students from schools under the district:
      // schoolAStudent (org at schoolA), schoolBStudent (org at schoolB),
      // classAStudent (class at classInSchoolA), grade5Student, grade3Student,
      // grade5EllStudent (all org at district level)
      // multiAssignedUser holds only 'administrator' role on districtA (via user_orgs),
      // with no 'student' role on any entity — excluded by the student role filter
      expect(result.totalItems).toBeGreaterThanOrEqual(6);

      const userIds = result.items.map((item) => item.userId);
      expect(userIds).toContain(baseFixture.schoolAStudent.id);
      expect(userIds).toContain(baseFixture.schoolBStudent.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.grade5Student.id);
      expect(userIds).toContain(baseFixture.grade3Student.id);
      expect(userIds).toContain(baseFixture.grade5EllStudent.id);
      expect(userIds).not.toContain(baseFixture.multiAssignedUser.id);
    });

    it('filters to student roles only (teachers and admins excluded)', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        [],
        { page: 1, perPage: 100 },
      );

      const userIds = result.items.map((item) => item.userId);

      // Teachers and admins should not appear
      expect(userIds).not.toContain(baseFixture.districtAdmin.id);
      expect(userIds).not.toContain(baseFixture.schoolAAdmin.id);
      expect(userIds).not.toContain(baseFixture.schoolATeacher.id);
      expect(userIds).not.toContain(baseFixture.classATeacher.id);
    });

    it('excludes students with expired enrollments', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'school', scopeId: baseFixture.schoolA.id },
        [],
        { page: 1, perPage: 100 },
      );

      const userIds = result.items.map((item) => item.userId);

      // expiredEnrollmentStudent has an expired enrollment at schoolA — should be excluded
      expect(userIds).not.toContain(baseFixture.expiredEnrollmentStudent.id);
      // futureEnrollmentStudent has a future enrollment at schoolA — should be excluded
      expect(userIds).not.toContain(baseFixture.futureEnrollmentStudent.id);
      // schoolAStudent has an active enrollment — should be included
      expect(userIds).toContain(baseFixture.schoolAStudent.id);
    });

    it('supports pagination (page 1 vs page 2)', async () => {
      const page1 = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        [],
        { page: 1, perPage: 2 },
      );

      const page2 = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        [],
        { page: 2, perPage: 2 },
      );

      expect(page1.items).toHaveLength(2);
      expect(page1.totalItems).toBeGreaterThanOrEqual(4);

      // Page 2 should have items (since totalItems >= 4)
      expect(page2.items.length).toBeGreaterThanOrEqual(1);

      // No overlap between pages
      const page1Ids = page1.items.map((i) => i.userId);
      const page2Ids = page2.items.map((i) => i.userId);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('returns empty runs map when no FDW runs exist', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        [baseFixture.variantForAllGrades.id],
        { page: 1, perPage: 100 },
      );

      // FDW table has no data in integration tests — all runs maps should be empty
      for (const item of result.items) {
        expect(item.runs.size).toBe(0);
      }
    });

    it('returns students for school scope', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToSchoolA.id,
        { scopeType: 'school', scopeId: baseFixture.schoolA.id },
        [],
        { page: 1, perPage: 100 },
      );

      const userIds = result.items.map((item) => item.userId);

      // schoolAStudent is a student at schoolA via user_orgs
      expect(userIds).toContain(baseFixture.schoolAStudent.id);
      // classAStudent is in classInSchoolA (schoolId = schoolA) via user_classes
      expect(userIds).toContain(baseFixture.classAStudent.id);
      // schoolBStudent should NOT appear — different school
      expect(userIds).not.toContain(baseFixture.schoolBStudent.id);
    });

    it('returns students for class scope', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToClassA.id,
        { scopeType: 'class', scopeId: baseFixture.classInSchoolA.id },
        [],
        { page: 1, perPage: 100 },
      );

      const userIds = result.items.map((item) => item.userId);

      // classAStudent is enrolled in classInSchoolA
      expect(userIds).toContain(baseFixture.classAStudent.id);
      // schoolAStudent is at the org level, not the class — should not appear
      expect(userIds).not.toContain(baseFixture.schoolAStudent.id);
    });

    it('returns students for group scope', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToGroup.id,
        { scopeType: 'group', scopeId: baseFixture.group.id },
        [],
        { page: 1, perPage: 100 },
      );

      const userIds = result.items.map((item) => item.userId);

      expect(userIds).toContain(baseFixture.groupStudent.id);
      // Students from other scopes should not appear
      expect(userIds).not.toContain(baseFixture.schoolAStudent.id);
    });

    it('populates schoolName for district scope', async () => {
      // Must pass non-empty taskVariantIds to avoid the early-return path
      // that skips getSchoolNamesForUsers and sets schoolName to null.
      // FDW run data won't exist in integration tests, but that's fine — we only
      // need the code to reach the school name resolution step.
      const taskVariantIds = [baseFixture.variantForAllGrades.id];

      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        taskVariantIds,
        { page: 1, perPage: 100 },
      );

      // schoolAStudent is enrolled at schoolA — should have a school name
      const schoolAStudentRow = result.items.find((i) => i.userId === baseFixture.schoolAStudent.id);
      expect(schoolAStudentRow).toBeDefined();
      expect(schoolAStudentRow!.schoolName).toBeTruthy();
    });

    it('does not populate schoolName for non-district scope', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToSchoolA.id,
        { scopeType: 'school', scopeId: baseFixture.schoolA.id },
        [],
        { page: 1, perPage: 100 },
      );

      // schoolName should be null for non-district scopes
      for (const item of result.items) {
        expect(item.schoolName).toBeNull();
      }
    });

    it('excludes students from other districts', async () => {
      const result = await repository.getProgressStudents(
        baseFixture.administrationAssignedToDistrict.id,
        { scopeType: 'district', scopeId: baseFixture.district.id },
        [],
        { page: 1, perPage: 100 },
      );

      const userIds = result.items.map((item) => item.userId);

      // districtBStudent is in a different district — should not appear
      expect(userIds).not.toContain(baseFixture.districtBStudent.id);
    });
  });
});
