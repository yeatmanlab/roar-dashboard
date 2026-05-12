/**
 * Integration tests for ReportRepository FDW queries.
 *
 * These tests verify the data access layer directly — no HTTP stack, no auth.
 * Assessment data is seeded via RunFactory into the assessment DB and queried
 * through the FDW foreign tables in the core DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ReportRepository, toReportAdminWindow } from './report.repository';
import type { ReportScope, ReportTaskMeta, ProgressOverviewCountsResult } from './report.repository';
import { baseFixture } from '../test-support/fixtures';
import { RunFactory } from '../test-support/factories/run.factory';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../test-support/factories/administration-group.factory';
import { AdministrationTaskVariantFactory } from '../test-support/factories/administration-task-variant.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { GroupFactory } from '../test-support/factories/group.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { UserGroupFactory } from '../test-support/factories/user-group.factory';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';

let repo: ReportRepository;

/** Default pagination options for tests. */
const defaultOptions = { page: 1, perPage: 25 };

/** Shorthand for the district-scoped administration and its variant IDs. */
let administrationId: string;
let allGradesVariantId: string;
let taskId: string;
let districtScope: ReportScope;
/**
 * Admin window of the base-fixture district administration. Reused by every
 * test that calls a `buildStudentInScopeQuery`-based method — those methods
 * are admin-aware (#1792). Tests that exercise specific past/future-admin
 * behavior construct their own admin window inline.
 */
let baseAdminWindow: { id: string; dateStart: Date; dateEnd: Date };

beforeAll(() => {
  repo = new ReportRepository();
  administrationId = baseFixture.administrationAssignedToDistrict.id;
  allGradesVariantId = baseFixture.variantForAllGrades.id;
  taskId = baseFixture.task.id;
  districtScope = { scopeType: 'district', scopeId: baseFixture.district.id };
  baseAdminWindow = toReportAdminWindow(baseFixture.administrationAssignedToDistrict);
});

describe('ReportRepository.getProgressStudents — FDW run queries', () => {
  describe('run status derivation', () => {
    it('returns completed run data when run has completedAt', async () => {
      const completedAt = new Date('2025-06-15T10:00:00Z');

      await RunFactory.create({
        userId: baseFixture.schoolAStudent.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt,
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.schoolAStudent.id);
      expect(studentRow).toBeDefined();

      const runInfo = studentRow!.runs.get(allGradesVariantId);
      expect(runInfo).toBeDefined();
      expect(runInfo!.completedAt).toEqual(completedAt);
      expect(runInfo!.startedAt).toBeInstanceOf(Date);
    });

    it('returns started run data when run has no completedAt', async () => {
      await RunFactory.create({
        userId: baseFixture.schoolBStudent.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: null,
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.schoolBStudent.id);
      expect(studentRow).toBeDefined();

      const runInfo = studentRow!.runs.get(allGradesVariantId);
      expect(runInfo).toBeDefined();
      expect(runInfo!.completedAt).toBeNull();
      expect(runInfo!.startedAt).toBeInstanceOf(Date);
    });

    it('returns empty runs map when student has no run for a variant', async () => {
      // classAStudent has no seeded run — their runs map should have no entry for the variant
      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.classAStudent.id);
      expect(studentRow).toBeDefined();
      expect(studentRow!.runs.has(allGradesVariantId)).toBe(false);
    });
  });

  describe('run filtering', () => {
    it('excludes soft-deleted runs', async () => {
      await RunFactory.create({
        userId: baseFixture.grade3Student.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
        deletedAt: new Date('2025-06-16T10:00:00Z'),
        deletedBy: baseFixture.districtAdmin.id,
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.grade3Student.id);
      expect(studentRow).toBeDefined();
      expect(studentRow!.runs.has(allGradesVariantId)).toBe(false);
    });

    it('excludes aborted runs', async () => {
      await RunFactory.create({
        userId: baseFixture.grade5Student.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: null,
        abortedAt: new Date('2025-06-15T12:00:00Z'),
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.grade5Student.id);
      expect(studentRow).toBeDefined();
      expect(studentRow!.runs.has(allGradesVariantId)).toBe(false);
    });

    it('excludes runs with useForReporting = false', async () => {
      await RunFactory.create({
        userId: baseFixture.grade5EllStudent.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: false,
        completedAt: new Date('2025-06-15T10:00:00Z'),
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.grade5EllStudent.id);
      expect(studentRow).toBeDefined();
      expect(studentRow!.runs.has(allGradesVariantId)).toBe(false);
    });
  });

  describe('run deduplication', () => {
    it('prefers completed run over started run for same variant', async () => {
      const studentId = baseFixture.schoolAStudent.id;
      const completedAt = new Date('2025-06-15T10:00:00Z');

      // Started run (created first)
      await RunFactory.create({
        userId: studentId,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: null,
      });

      // Completed run (created second)
      await RunFactory.create({
        userId: studentId,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt,
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === studentId);
      expect(studentRow).toBeDefined();

      const runInfo = studentRow!.runs.get(allGradesVariantId);
      expect(runInfo).toBeDefined();
      expect(runInfo!.completedAt).toEqual(completedAt);
    });

    it('prefers most recent completedAt among completed runs', async () => {
      const studentId = baseFixture.schoolBStudent.id;
      const olderCompletedAt = new Date('2025-06-10T10:00:00Z');
      const newerCompletedAt = new Date('2025-06-15T10:00:00Z');

      // Older completed run
      await RunFactory.create({
        userId: studentId,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: olderCompletedAt,
      });

      // Newer completed run
      await RunFactory.create({
        userId: studentId,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: newerCompletedAt,
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === studentId);
      expect(studentRow).toBeDefined();

      const runInfo = studentRow!.runs.get(allGradesVariantId);
      expect(runInfo).toBeDefined();
      expect(runInfo!.completedAt).toEqual(newerCompletedAt);
    });
  });

  describe('multi-variant query (same taskId)', () => {
    // These tests use variantForGrade3 and variantForGrade5 — variants that have
    // no runs seeded by earlier tests — to avoid cross-test contamination from
    // the run status and deduplication tests above (which seed on allGradesVariantId).
    const grade3VariantId = () => baseFixture.variantForGrade3.id;
    const grade5VariantId = () => baseFixture.variantForGrade5.id;

    it('returns independent run entries per variant when multiple variant IDs are passed', async () => {
      // classAStudent: completed run on grade3Variant, no run on grade5Variant
      await RunFactory.create({
        userId: baseFixture.classAStudent.id,
        taskId,
        taskVariantId: grade3VariantId(),
        administrationId,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [grade3VariantId(), grade5VariantId()],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.classAStudent.id);
      expect(studentRow).toBeDefined();

      // The runs Map should have an entry for the variant with a run
      const grade3Run = studentRow!.runs.get(grade3VariantId());
      expect(grade3Run).toBeDefined();
      expect(grade3Run!.completedAt).toEqual(new Date('2025-06-15T10:00:00Z'));

      // And no entry for the variant without a run
      expect(studentRow!.runs.has(grade5VariantId())).toBe(false);
    });

    it('returns runs for both variants when student has runs for each', async () => {
      // schoolAStudent: completed run on grade3Variant, started run on grade5Variant
      await RunFactory.create({
        userId: baseFixture.schoolAStudent.id,
        taskId,
        taskVariantId: grade3VariantId(),
        administrationId,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
      });

      await RunFactory.create({
        userId: baseFixture.schoolAStudent.id,
        taskId,
        taskVariantId: grade5VariantId(),
        administrationId,
        useForReporting: true,
        completedAt: null,
      });

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [grade3VariantId(), grade5VariantId()],
        defaultOptions,
      );

      const studentRow = result.items.find((item) => item.userId === baseFixture.schoolAStudent.id);
      expect(studentRow).toBeDefined();

      // Both variants should have entries in the runs Map
      const grade3Run = studentRow!.runs.get(grade3VariantId());
      expect(grade3Run).toBeDefined();
      expect(grade3Run!.completedAt).toEqual(new Date('2025-06-15T10:00:00Z'));

      const grade5Run = studentRow!.runs.get(grade5VariantId());
      expect(grade5Run).toBeDefined();
      expect(grade5Run!.completedAt).toBeNull();
      expect(grade5Run!.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('multiple students with different run states', () => {
    // Use students whose earlier-seeded runs are invisible to the FDW query
    // (soft-deleted, aborted, or useForReporting=false), avoiding test isolation
    // issues from runs accumulated by prior tests in the same file.
    it('returns correct run data per student', async () => {
      const completedAt = new Date('2025-06-15T10:00:00Z');

      // grade3Student: completed run (earlier soft-deleted run is filtered out)
      await RunFactory.create({
        userId: baseFixture.grade3Student.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt,
      });

      // grade5Student: started run (earlier aborted run is filtered out)
      await RunFactory.create({
        userId: baseFixture.grade5Student.id,
        taskId,
        taskVariantId: allGradesVariantId,
        administrationId,
        useForReporting: true,
        completedAt: null,
      });

      // classAStudent: no run at all

      const result = await repo.getProgressStudents(
        administrationId,
        districtScope,
        baseAdminWindow,
        [allGradesVariantId],
        defaultOptions,
      );

      // grade3Student should have completed run
      const completedStudent = result.items.find((item) => item.userId === baseFixture.grade3Student.id);
      expect(completedStudent).toBeDefined();
      expect(completedStudent!.runs.get(allGradesVariantId)?.completedAt).toEqual(completedAt);

      // grade5Student should have started run
      const startedStudent = result.items.find((item) => item.userId === baseFixture.grade5Student.id);
      expect(startedStudent).toBeDefined();
      expect(startedStudent!.runs.get(allGradesVariantId)?.completedAt).toBeNull();
      expect(startedStudent!.runs.get(allGradesVariantId)?.startedAt).toBeInstanceOf(Date);

      // classAStudent should have no run
      const noRunStudent = result.items.find((item) => item.userId === baseFixture.classAStudent.id);
      expect(noRunStudent).toBeDefined();
      expect(noRunStudent!.runs.has(allGradesVariantId)).toBe(false);
    });
  });
});

describe('ReportRepository.getProgressOverviewCountsBulk — multi-scope aggregation', () => {
  /**
   * Uses a separate administration with two simple task variants (no conditions)
   * assigned to two school scopes. Runs are seeded to produce distinct student
   * distributions at each scope, verifying the scope_id discriminator partitions
   * task counts and student-level counts correctly.
   *
   * Scope layout:
   *   School A: schoolAStudent (org), classAStudent (class in school A)
   *   School B: schoolBStudent (org)
   *
   * Task variants: two required tasks (no conditions), from task and task2.
   *
   * Run seeding:
   *   schoolAStudent: completed both → completed
   *   classAStudent:  completed task1 only → started
   *   schoolBStudent: no runs → assigned
   */
  let bulkAdminId: string;
  let bulkTaskMetas: ReportTaskMeta[];
  let schoolAScope: ReportScope;
  let schoolBScope: ReportScope;
  let bulkResult: Map<string, ProgressOverviewCountsResult>;

  beforeAll(async () => {
    const bulkRepo = new ReportRepository();

    // Create a dedicated administration for this test suite
    const bulkAdmin = await AdministrationFactory.create({
      name: 'Bulk Overview Test Administration',
      createdBy: baseFixture.districtAdmin.id,
    });
    bulkAdminId = bulkAdmin.id;

    // Assign administration to both schools
    await Promise.all([
      AdministrationOrgFactory.create({ administrationId: bulkAdminId, orgId: baseFixture.schoolA.id }),
      AdministrationOrgFactory.create({ administrationId: bulkAdminId, orgId: baseFixture.schoolB.id }),
    ]);

    // Assign two unconditional task variants (required for all students)
    await Promise.all([
      AdministrationTaskVariantFactory.create({
        administrationId: bulkAdminId,
        taskVariantId: baseFixture.variantForAllGrades.id,
        orderIndex: 0,
      }),
      AdministrationTaskVariantFactory.create({
        administrationId: bulkAdminId,
        taskVariantId: baseFixture.variantForTask2.id,
        orderIndex: 1,
      }),
    ]);

    // Fetch resolved task metadata
    bulkTaskMetas = await bulkRepo.getTaskMetadata(bulkAdminId);

    // Seed runs:
    // schoolAStudent: completed both tasks → bucket: completed
    await RunFactory.create({
      userId: baseFixture.schoolAStudent.id,
      taskId: baseFixture.task.id,
      taskVariantId: baseFixture.variantForAllGrades.id,
      administrationId: bulkAdminId,
      useForReporting: true,
      completedAt: new Date('2025-07-01T10:00:00Z'),
    });
    await RunFactory.create({
      userId: baseFixture.schoolAStudent.id,
      taskId: baseFixture.task2.id,
      taskVariantId: baseFixture.variantForTask2.id,
      administrationId: bulkAdminId,
      useForReporting: true,
      completedAt: new Date('2025-07-01T11:00:00Z'),
    });

    // classAStudent: completed task1, no run on task2 → bucket: started
    await RunFactory.create({
      userId: baseFixture.classAStudent.id,
      taskId: baseFixture.task.id,
      taskVariantId: baseFixture.variantForAllGrades.id,
      administrationId: bulkAdminId,
      useForReporting: true,
      completedAt: new Date('2025-07-01T12:00:00Z'),
    });

    // schoolBStudent: no runs → bucket: assigned

    // Execute the bulk query with both scopes
    schoolAScope = { scopeType: 'school', scopeId: baseFixture.schoolA.id };
    schoolBScope = { scopeType: 'school', scopeId: baseFixture.schoolB.id };
    const bulkAdminWindow = toReportAdminWindow(bulkAdmin);
    bulkResult = await bulkRepo.getProgressOverviewCountsBulk(
      bulkAdminId,
      [schoolAScope, schoolBScope],
      bulkAdminWindow,
      bulkTaskMetas,
    );
  });

  it('returns results for both scopes', () => {
    expect(bulkResult.size).toBe(2);
    expect(bulkResult.has(baseFixture.schoolA.id)).toBe(true);
    expect(bulkResult.has(baseFixture.schoolB.id)).toBe(true);
  });

  it('computes correct totalStudents per scope', () => {
    // School A: schoolAStudent (org) + classAStudent (class in school A)
    expect(bulkResult.get(baseFixture.schoolA.id)!.totalStudents).toBe(2);
    // School B: schoolBStudent (org)
    expect(bulkResult.get(baseFixture.schoolB.id)!.totalStudents).toBe(1);
  });

  it('computes independent student-level counts per scope', () => {
    const schoolACounts = bulkResult.get(baseFixture.schoolA.id)!.studentCounts;
    expect(schoolACounts.studentsWithRequiredTasks).toBe(2);
    expect(schoolACounts.studentsCompleted).toBe(1); // schoolAStudent
    expect(schoolACounts.studentsStarted).toBe(1); // classAStudent
    expect(schoolACounts.studentsAssigned).toBe(0);

    const schoolBCounts = bulkResult.get(baseFixture.schoolB.id)!.studentCounts;
    expect(schoolBCounts.studentsWithRequiredTasks).toBe(1);
    expect(schoolBCounts.studentsCompleted).toBe(0);
    expect(schoolBCounts.studentsStarted).toBe(0);
    expect(schoolBCounts.studentsAssigned).toBe(1); // schoolBStudent
  });

  it('satisfies the assigned + started + completed = studentsWithRequiredTasks invariant per scope', () => {
    for (const scopeId of [baseFixture.schoolA.id, baseFixture.schoolB.id]) {
      const counts = bulkResult.get(scopeId)!.studentCounts;
      expect(counts.studentsAssigned + counts.studentsStarted + counts.studentsCompleted).toBe(
        counts.studentsWithRequiredTasks,
      );
    }
  });

  it('computes independent task status counts per scope', () => {
    const schoolATaskCounts = bulkResult.get(baseFixture.schoolA.id)!.taskStatusCounts;
    const schoolBTaskCounts = bulkResult.get(baseFixture.schoolB.id)!.taskStatusCounts;

    // School A task1 (variantForAllGrades): 2 students completed → 2× completed-required
    const schoolATask1Completed = schoolATaskCounts.filter(
      (tc) => tc.taskId === baseFixture.task.id && tc.status === 'completed-required',
    );
    expect(schoolATask1Completed).toHaveLength(1);
    expect(schoolATask1Completed[0]!.count).toBe(2);

    // School A task2 (variantForTask2): 1 completed (schoolAStudent), 1 assigned (classAStudent)
    const schoolATask2Completed = schoolATaskCounts.filter(
      (tc) => tc.taskId === baseFixture.task2.id && tc.status === 'completed-required',
    );
    expect(schoolATask2Completed).toHaveLength(1);
    expect(schoolATask2Completed[0]!.count).toBe(1);

    const schoolATask2Assigned = schoolATaskCounts.filter(
      (tc) => tc.taskId === baseFixture.task2.id && tc.status === 'assigned-required',
    );
    expect(schoolATask2Assigned).toHaveLength(1);
    expect(schoolATask2Assigned[0]!.count).toBe(1);

    // School B task1: 1 student assigned → 1× assigned-required
    const schoolBTask1Assigned = schoolBTaskCounts.filter(
      (tc) => tc.taskId === baseFixture.task.id && tc.status === 'assigned-required',
    );
    expect(schoolBTask1Assigned).toHaveLength(1);
    expect(schoolBTask1Assigned[0]!.count).toBe(1);

    // School B task2: 1 student assigned → 1× assigned-required
    const schoolBTask2Assigned = schoolBTaskCounts.filter(
      (tc) => tc.taskId === baseFixture.task2.id && tc.status === 'assigned-required',
    );
    expect(schoolBTask2Assigned).toHaveLength(1);
    expect(schoolBTask2Assigned[0]!.count).toBe(1);
  });

  it('does not leak students across scopes', () => {
    // School B should have no completed or started students
    const schoolBCounts = bulkResult.get(baseFixture.schoolB.id)!.studentCounts;
    expect(schoolBCounts.studentsCompleted).toBe(0);
    expect(schoolBCounts.studentsStarted).toBe(0);

    // School B should have no completed-required task counts
    const schoolBCompleted = bulkResult
      .get(baseFixture.schoolB.id)!
      .taskStatusCounts.filter((tc) => tc.status === 'completed-required');
    expect(schoolBCompleted).toHaveLength(0);
  });
});

describe('ReportRepository.countRosteringEndedExclusions — #1742', () => {
  /**
   * Each scope type gets a freshly created entity hierarchy and its own
   * students, so the count is deterministic regardless of which other tests
   * have seeded data on `baseFixture`. Both exclusion reasons are exercised:
   *
   * - User-level: `users.rosteringEnded <= NOW()`
   * - Entity-level: parent entity's `rosteringEnded <= NOW()` (org / class /
   *   group). The user themselves remains active.
   */
  let testRepo: ReportRepository;

  beforeAll(() => {
    testRepo = new ReportRepository();
  });

  const past = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
  const future = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  describe('district scope', () => {
    it('counts users excluded only at the user level (rostering-ended user, active district)', async () => {
      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'District UserLevel Exclude',
      });

      // 1 active student (must NOT be counted as excluded)
      const activeStudent = await UserFactory.create({ nameLast: 'ActiveDistrictStudent' });
      await UserOrgFactory.create({ userId: activeStudent.id, orgId: district.id, role: UserRole.STUDENT });

      // 2 rostering-ended students (MUST be counted as excluded — distinct count = 2)
      const endedStudent1 = await UserFactory.create({ nameLast: 'EndedDistrictStudent1', rosteringEnded: past() });
      const endedStudent2 = await UserFactory.create({ nameLast: 'EndedDistrictStudent2', rosteringEnded: past() });
      await UserOrgFactory.create({ userId: endedStudent1.id, orgId: district.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: endedStudent2.id, orgId: district.id, role: UserRole.STUDENT });

      // Future-dated rostering-end is still active and must NOT be counted
      const futureEndedStudent = await UserFactory.create({
        nameLast: 'FutureEndedDistrictStudent',
        rosteringEnded: future(),
      });
      await UserOrgFactory.create({ userId: futureEndedStudent.id, orgId: district.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'district', scopeId: district.id },
        baseAdminWindow,
      );
      expect(count).toBe(2);
    });

    it('counts students excluded by descendant class rostering-ended even when no user is decommissioned', async () => {
      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'District EntityLevel Exclude',
      });
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School Under District Entity Exclude',
        parentOrgId: district.id,
      });
      const endedClass = await ClassFactory.create({
        name: 'Ended Class Under District',
        schoolId: school.id,
        districtId: district.id,
        rosteringEnded: past(),
      });

      const student = await UserFactory.create({ nameLast: 'ActiveStudentInEndedClass' });
      await UserClassFactory.create({ userId: student.id, classId: endedClass.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'district', scopeId: district.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });

    it('does NOT count a student whose excluded-class enrollment is offset by an active org enrollment', async () => {
      // Anti-join correctness: a student enrolled in BOTH an active org
      // (visible via the org branch) AND a rostering-ended class (excluded
      // via the class branch) appears in `items` AND would naively also
      // appear in the exclusion count. The anti-join against
      // `buildStudentInScopeQuery` removes them — we should report 0
      // exclusions because every "excluded" student is still visible.
      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'District DualEnrollment AntiJoin',
      });
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School Under District DualEnrollment',
        parentOrgId: district.id,
      });
      const endedClass = await ClassFactory.create({
        name: 'Ended Class Dual Enrollment',
        schoolId: school.id,
        districtId: district.id,
        rosteringEnded: past(),
      });

      // Student is in the rostering-ended class AND in the active school
      // org. The active org enrollment makes them visible in `items`.
      const student = await UserFactory.create({ nameLast: 'DualEnrollmentStudent' });
      await UserClassFactory.create({ userId: student.id, classId: endedClass.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: student.id, orgId: school.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'district', scopeId: district.id },
        baseAdminWindow,
      );
      expect(count).toBe(0);
    });

    it('counts a student once when excluded for both user-level and entity-level reasons', async () => {
      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'District Both Reasons Exclude',
      });
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School Under District Both Reasons',
        parentOrgId: district.id,
      });
      const endedClass = await ClassFactory.create({
        name: 'Ended Class For Dedup',
        schoolId: school.id,
        districtId: district.id,
        rosteringEnded: past(),
      });

      // Student is both rostering-ended themselves AND in a rostering-ended class.
      const doubleExcluded = await UserFactory.create({
        nameLast: 'DoubleExcludedStudent',
        rosteringEnded: past(),
      });
      await UserClassFactory.create({ userId: doubleExcluded.id, classId: endedClass.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'district', scopeId: district.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });

    it('returns 0 when no students are excluded', async () => {
      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'District No Exclusions',
      });
      const student = await UserFactory.create({ nameLast: 'ActiveDistrictStudentOnly' });
      await UserOrgFactory.create({ userId: student.id, orgId: district.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'district', scopeId: district.id },
        baseAdminWindow,
      );
      expect(count).toBe(0);
    });

    it('only counts students (non-student roles are ignored)', async () => {
      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'District Role Filter Exclude',
      });

      const endedTeacher = await UserFactory.create({ nameLast: 'EndedTeacher', rosteringEnded: past() });
      const endedStudent = await UserFactory.create({ nameLast: 'EndedStudentRoleFilter', rosteringEnded: past() });

      await UserOrgFactory.create({ userId: endedTeacher.id, orgId: district.id, role: UserRole.TEACHER });
      await UserOrgFactory.create({ userId: endedStudent.id, orgId: district.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'district', scopeId: district.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });
  });

  describe('school scope', () => {
    it('counts user-level and class-entity-level exclusions distinctly', async () => {
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School Exclude Mix',
        parentOrgId: baseFixture.district.id,
      });
      const endedClass = await ClassFactory.create({
        name: 'Ended Class In School Scope',
        schoolId: school.id,
        districtId: baseFixture.district.id,
        rosteringEnded: past(),
      });

      // Org-level: 1 user-level exclusion
      const orgEndedStudent = await UserFactory.create({
        nameLast: 'OrgEndedSchoolStudent',
        rosteringEnded: past(),
      });
      await UserOrgFactory.create({ userId: orgEndedStudent.id, orgId: school.id, role: UserRole.STUDENT });

      // Class-level: 1 active user in an ended class
      const classOrphanStudent = await UserFactory.create({ nameLast: 'ClassOrphanStudent' });
      await UserClassFactory.create({ userId: classOrphanStudent.id, classId: endedClass.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'school', scopeId: school.id },
        baseAdminWindow,
      );
      expect(count).toBe(2);
    });
  });

  describe('class scope', () => {
    it('counts user-level exclusions for students directly in the class', async () => {
      const klass = await ClassFactory.create({
        name: 'Class Exclude Direct',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });

      const activeStudent = await UserFactory.create({ nameLast: 'ActiveClassStudentDirect' });
      const endedStudent = await UserFactory.create({
        nameLast: 'EndedClassStudentDirect',
        rosteringEnded: past(),
      });

      await UserClassFactory.create({ userId: activeStudent.id, classId: klass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: endedStudent.id, classId: klass.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'class', scopeId: klass.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });

    it('counts entity-level exclusion (rostering-ended class) for active enrollees', async () => {
      const endedKlass = await ClassFactory.create({
        name: 'Class Exclude EntityLevel',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
        rosteringEnded: past(),
      });

      const student = await UserFactory.create({ nameLast: 'ActiveStudentInEndedClassDirect' });
      await UserClassFactory.create({ userId: student.id, classId: endedKlass.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'class', scopeId: endedKlass.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });
  });

  describe('group scope', () => {
    it('counts user-level exclusions for group members', async () => {
      const group = await GroupFactory.create({ name: 'Group Exclude UserLevel' });

      const activeStudent = await UserFactory.create({ nameLast: 'ActiveGroupStudentExclude' });
      const endedStudent = await UserFactory.create({
        nameLast: 'EndedGroupStudentExclude',
        rosteringEnded: past(),
      });

      await UserGroupFactory.create({ userId: activeStudent.id, groupId: group.id, role: UserRole.STUDENT });
      await UserGroupFactory.create({ userId: endedStudent.id, groupId: group.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'group', scopeId: group.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });

    it('counts entity-level exclusion (rostering-ended group) for active members', async () => {
      const endedGroup = await GroupFactory.create({
        name: 'Group Exclude EntityLevel',
        rosteringEnded: past(),
      });

      const student = await UserFactory.create({ nameLast: 'ActiveStudentInEndedGroup' });
      await UserGroupFactory.create({ userId: student.id, groupId: endedGroup.id, role: UserRole.STUDENT });

      const count = await testRepo.countRosteringEndedExclusions(
        { scopeType: 'group', scopeId: endedGroup.id },
        baseAdminWindow,
      );
      expect(count).toBe(1);
    });
  });
});

describe('ReportRepository admin-aware enrollment overlap — #1792', () => {
  /**
   * Direct coverage for the strict admin-aware overlap predicate and the
   * `includeUnenrolledStudents` toggle introduced by #1792.
   *
   * Most reporting tests above happen to satisfy the new predicate (the
   * `baseFixture` students all have `enrollmentStart = NOW()` and no end
   * date, so they pass both the legacy and admin-aware checks). The matrix
   * here exercises the *differences* between the two — past administrations,
   * mid-window withdrawals, future enrollments, and the toggle-on
   * withdrawn-with-data path — so any regression in the predicate (e.g.,
   * forgetting the `LEAST(adminDateEnd, NOW())` clamp on the start side)
   * surfaces here rather than in subtle production behavior changes.
   *
   * Tests are isolated per scenario: each `it` creates its own org / class /
   * admin / users so they don't pollute the shared `baseFixture` or each
   * other.
   */
  let testRepo: ReportRepository;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const daysAgo = (n: number) => new Date(Date.now() - n * ONE_DAY_MS);
  const daysFromNow = (n: number) => new Date(Date.now() + n * ONE_DAY_MS);

  beforeAll(() => {
    testRepo = new ReportRepository();
  });

  /**
   * Create a self-contained admin + district + task assignment for a test.
   * Returns the admin window + scope + variant info the test will need.
   */
  async function setupIsolatedAdmin(opts: { dateStart: Date; dateEnd: Date; name: string }) {
    const district = await OrgFactory.create({
      orgType: OrgType.DISTRICT,
      name: `${opts.name} District`,
    });
    const admin = await AdministrationFactory.create({
      name: opts.name,
      createdBy: baseFixture.districtAdmin.id,
      dateStart: opts.dateStart,
      dateEnd: opts.dateEnd,
    });
    await AdministrationOrgFactory.create({ administrationId: admin.id, orgId: district.id });
    await AdministrationTaskVariantFactory.create({
      administrationId: admin.id,
      taskVariantId: baseFixture.variantForAllGrades.id,
      orderIndex: 0,
    });

    const adminWindow = toReportAdminWindow(admin);
    const scope: ReportScope = { scopeType: 'district', scopeId: district.id };
    const taskMetas: ReportTaskMeta[] = await testRepo.getTaskMetadata(admin.id);

    return { admin, district, adminWindow, scope, taskMetas };
  }

  describe('strict overlap (default — includeUnenrolledStudents=false)', () => {
    describe('past administration', () => {
      it('excludes a student who enrolled AFTER the admin closed', async () => {
        // Legacy `isEnrollmentActive` would have counted this student
        // (enrolled "now"); the admin-aware predicate must not, because
        // they weren't enrolled during the admin's window.
        const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
          name: 'Past admin — late enroller',
          dateStart: daysAgo(60),
          dateEnd: daysAgo(30),
        });

        // Enrolled 10 days ago — 20 days after the admin closed.
        const lateEnroller = await UserFactory.create({ nameLast: 'PastAdminLateEnroller' });
        await UserOrgFactory.create({
          userId: lateEnroller.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(10),
          enrollmentEnd: null,
        });

        const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(0);
      });

      it('includes a student enrolled before the window closed with no end date', async () => {
        const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
          name: 'Past admin — early enroller, still active',
          dateStart: daysAgo(60),
          dateEnd: daysAgo(30),
        });

        const earlyEnroller = await UserFactory.create({ nameLast: 'PastAdminEarlyEnroller' });
        await UserOrgFactory.create({
          userId: earlyEnroller.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(90),
          enrollmentEnd: null,
        });

        const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(1);
      });

      it('excludes a student who left mid-window when the toggle is off', async () => {
        const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
          name: 'Past admin — withdrew mid-window, no toggle',
          dateStart: daysAgo(60),
          dateEnd: daysAgo(30),
        });

        const withdrawn = await UserFactory.create({ nameLast: 'PastAdminMidWindowWithdrawn' });
        await UserOrgFactory.create({
          userId: withdrawn.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(90),
          enrollmentEnd: daysAgo(45), // left during admin window
        });

        // Even though they ran the assessment, the toggle is off, so they
        // fail strict overlap (`enrollment.end > LEAST(adminDateEnd, NOW())`
        // → `45d ago > 30d ago` is false).
        await RunFactory.create({
          userId: withdrawn.id,
          taskId: baseFixture.task.id,
          taskVariantId: baseFixture.variantForAllGrades.id,
          administrationId: adminWindow.id,
          useForReporting: true,
          completedAt: daysAgo(50),
        });

        const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(0);
      });
    });

    describe('active administration', () => {
      it('excludes a student whose enrollment starts in the future', async () => {
        // Regression guard for the start-side LEAST clamp: without it, a
        // student enrolling next week would pass `enrollment.start <=
        // admin.dateEnd` whenever the admin extends past their start.
        const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
          name: 'Active admin — future enroller',
          dateStart: daysAgo(15),
          dateEnd: daysFromNow(30),
        });

        const futureEnroller = await UserFactory.create({ nameLast: 'ActiveAdminFutureEnroller' });
        await UserOrgFactory.create({
          userId: futureEnroller.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysFromNow(7),
          enrollmentEnd: null,
        });

        const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(0);
      });

      it('includes a currently-enrolled student (matches legacy isEnrollmentActive)', async () => {
        const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
          name: 'Active admin — current enroller',
          dateStart: daysAgo(15),
          dateEnd: daysFromNow(30),
        });

        const current = await UserFactory.create({ nameLast: 'ActiveAdminCurrentEnroller' });
        await UserOrgFactory.create({
          userId: current.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(5),
          enrollmentEnd: null,
        });

        const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(1);
      });
    });

    describe('future administration', () => {
      it('uses LEAST(adminDateEnd, NOW()) = NOW() so currently-enrolled students still count', async () => {
        // A purely-future admin still asks the present-tense question:
        // who is enrolled right now? It does not, e.g., narrow to students
        // whose enrollment starts inside the future window.
        const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
          name: 'Future admin — current enroller',
          dateStart: daysFromNow(30),
          dateEnd: daysFromNow(60),
        });

        const current = await UserFactory.create({ nameLast: 'FutureAdminCurrentEnroller' });
        await UserOrgFactory.create({
          userId: current.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(5),
          enrollmentEnd: null,
        });

        const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(1);
      });
    });

    describe('scope branches (acceptance criteria — verify on each scope)', () => {
      // The admin-aware predicate itself lives in a closure (`enrollmentPredicate`)
      // applied identically across every UNION branch of
      // `buildStudentInScopeQuery`, so the district tests above are enough to pin
      // the predicate's logic. The scenarios here cover the other half of the
      // contract: that each scope branch applies the predicate at all (i.e., the
      // closure is actually wired into `EntityType.CLASS` and `EntityType.GROUP`,
      // not just the district branch). One past-admin case per scope is enough —
      // we're verifying the wire-up, not re-deriving the predicate semantics.

      it('class scope: applies admin-aware overlap to user_classes', async () => {
        const admin = await AdministrationFactory.create({
          name: 'Class-scope admin-aware overlap',
          createdBy: baseFixture.districtAdmin.id,
          dateStart: daysAgo(60),
          dateEnd: daysAgo(30),
        });
        const klass = await ClassFactory.create({
          name: 'Class-scope admin-aware overlap class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        await AdministrationClassFactory.create({ administrationId: admin.id, classId: klass.id });
        await AdministrationTaskVariantFactory.create({
          administrationId: admin.id,
          taskVariantId: baseFixture.variantForAllGrades.id,
          orderIndex: 0,
        });

        // Enrolled before admin opened, still active — should count.
        const earlyEnroller = await UserFactory.create({ nameLast: 'ClassScopeEarlyEnroller' });
        await UserClassFactory.create({
          userId: earlyEnroller.id,
          classId: klass.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(90),
          enrollmentEnd: null,
        });

        // Enrolled after admin closed — must NOT count under strict overlap
        // for a past admin.
        const lateEnroller = await UserFactory.create({ nameLast: 'ClassScopeLateEnroller' });
        await UserClassFactory.create({
          userId: lateEnroller.id,
          classId: klass.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(10),
          enrollmentEnd: null,
        });

        const adminWindow = toReportAdminWindow(admin);
        const scope: ReportScope = { scopeType: 'class', scopeId: klass.id };
        const taskMetas = await testRepo.getTaskMetadata(admin.id);

        const result = await testRepo.getProgressOverviewCounts(admin.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(1);
      });

      it('group scope: applies admin-aware overlap to user_groups', async () => {
        const admin = await AdministrationFactory.create({
          name: 'Group-scope admin-aware overlap',
          createdBy: baseFixture.districtAdmin.id,
          dateStart: daysAgo(60),
          dateEnd: daysAgo(30),
        });
        const group = await GroupFactory.create({ name: 'Group-scope admin-aware overlap group' });
        await AdministrationGroupFactory.create({ administrationId: admin.id, groupId: group.id });
        await AdministrationTaskVariantFactory.create({
          administrationId: admin.id,
          taskVariantId: baseFixture.variantForAllGrades.id,
          orderIndex: 0,
        });

        const earlyEnroller = await UserFactory.create({ nameLast: 'GroupScopeEarlyEnroller' });
        await UserGroupFactory.create({
          userId: earlyEnroller.id,
          groupId: group.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(90),
          enrollmentEnd: null,
        });

        const lateEnroller = await UserFactory.create({ nameLast: 'GroupScopeLateEnroller' });
        await UserGroupFactory.create({
          userId: lateEnroller.id,
          groupId: group.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(10),
          enrollmentEnd: null,
        });

        const adminWindow = toReportAdminWindow(admin);
        const scope: ReportScope = { scopeType: 'group', scopeId: group.id };
        const taskMetas = await testRepo.getTaskMetadata(admin.id);

        const result = await testRepo.getProgressOverviewCounts(admin.id, scope, adminWindow, taskMetas);
        expect(result.totalStudents).toBe(1);
      });
    });
  });

  describe('withdrawn-with-data inclusion (includeUnenrolledStudents=true)', () => {
    it('includes a left-mid-window student with a non-deleted, non-aborted run', async () => {
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Toggle on — withdrew with completed run',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'ToggleWithdrawnWithRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });
      await RunFactory.create({
        userId: withdrawn.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(50),
      });

      const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas, true);
      expect(result.totalStudents).toBe(1);
    });

    it('does not bring back a withdrawn student whose only run is soft-deleted', async () => {
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Toggle on — deleted run only',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'ToggleWithdrawnDeletedRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });
      await RunFactory.create({
        userId: withdrawn.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(50),
        deletedAt: daysAgo(40),
        // `runs_deleted_by_required` CHECK requires deletedBy when deletedAt is set.
        deletedBy: baseFixture.districtAdmin.id,
      });

      const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas, true);
      expect(result.totalStudents).toBe(0);
    });

    it('does not bring back a withdrawn student whose only run is aborted', async () => {
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Toggle on — aborted run only',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'ToggleWithdrawnAbortedRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });
      await RunFactory.create({
        userId: withdrawn.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        abortedAt: daysAgo(50),
      });

      const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas, true);
      expect(result.totalStudents).toBe(0);
    });

    it('does not bring back a withdrawn student with no run at all', async () => {
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Toggle on — no run',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'ToggleWithdrawnNoRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });

      const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas, true);
      expect(result.totalStudents).toBe(0);
    });

    it('uses strict gt() for end > check vs strict lte() for end <= check at the exact boundary', async () => {
      // `isEnrollmentActiveForAdmin` uses `gt(end, LEAST(adminEnd, NOW()))`
      // and `hasWithdrawnWithDataForAdmin` uses `lte(end, LEAST(...))`.
      // At the exact boundary (`enrollment.end === admin.dateEnd` and
      // adminDateEnd in the past so LEAST=adminEnd), the strict overlap
      // branch rejects (gt is false) and only the toggle-on path accepts.
      // This is the "left on closing day" cohort — encoded in operator
      // choice, easy to flip silently, worth pinning.
      const dateEnd = daysAgo(30);
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Toggle on — boundary equality',
        dateStart: daysAgo(60),
        dateEnd,
      });

      const boundary = await UserFactory.create({ nameLast: 'BoundaryEqualityStudent' });
      await UserOrgFactory.create({
        userId: boundary.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: dateEnd, // exactly on admin.dateEnd
      });
      await RunFactory.create({
        userId: boundary.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(45),
      });

      // Toggle off: strict gt rejects.
      const strict = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas);
      expect(strict.totalStudents).toBe(0);

      // Toggle on: withdrawn-with-data lte accepts.
      const withToggle = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas, true);
      expect(withToggle.totalStudents).toBe(1);
    });

    it('does not double-count a strict-overlap student who also has a qualifying run', async () => {
      // Strict overlap + withdrawn-with-data are UNION-ed (not UNION ALL):
      // a student who passes both branches must be counted once.
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Toggle on — strict + withdrawn dedup',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const active = await UserFactory.create({ nameLast: 'ToggleDedupActive' });
      await UserOrgFactory.create({
        userId: active.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: null,
      });
      await RunFactory.create({
        userId: active.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(50),
      });

      const result = await testRepo.getProgressOverviewCounts(adminWindow.id, scope, adminWindow, taskMetas, true);
      expect(result.totalStudents).toBe(1);
    });
  });

  describe('verifyStudentInScope — per-student endpoint always permits withdrawn-with-data', () => {
    it('returns true for a currently-enrolled student (strict overlap)', async () => {
      const { adminWindow, scope, district } = await setupIsolatedAdmin({
        name: 'verifyStudentInScope — strict student',
        dateStart: daysAgo(60),
        dateEnd: daysFromNow(30),
      });

      const student = await UserFactory.create({ nameLast: 'VerifyStrictStudent' });
      await UserOrgFactory.create({
        userId: student.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(10),
        enrollmentEnd: null,
      });

      const ok = await testRepo.verifyStudentInScope(scope, adminWindow, student.id);
      expect(ok).toBe(true);
    });

    it('returns true for a withdrawn-with-data student even though the list endpoints would default to off', async () => {
      // The per-student endpoint always allows the withdrawn-with-data
      // path — it does not honor the `includeUnenrolledStudents` toggle.
      const { adminWindow, scope, district } = await setupIsolatedAdmin({
        name: 'verifyStudentInScope — withdrawn with run',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'VerifyWithdrawnWithRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });
      await RunFactory.create({
        userId: withdrawn.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(50),
      });

      const ok = await testRepo.verifyStudentInScope(scope, adminWindow, withdrawn.id);
      expect(ok).toBe(true);
    });

    it('returns false for a withdrawn student with no qualifying run', async () => {
      const { adminWindow, scope, district } = await setupIsolatedAdmin({
        name: 'verifyStudentInScope — withdrawn no run',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'VerifyWithdrawnNoRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });

      const ok = await testRepo.verifyStudentInScope(scope, adminWindow, withdrawn.id);
      expect(ok).toBe(false);
    });

    it('returns false for a withdrawn student whose only run is soft-deleted', async () => {
      const { adminWindow, scope, district } = await setupIsolatedAdmin({
        name: 'verifyStudentInScope — withdrawn deleted run',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const withdrawn = await UserFactory.create({ nameLast: 'VerifyWithdrawnDeletedRun' });
      await UserOrgFactory.create({
        userId: withdrawn.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });
      await RunFactory.create({
        userId: withdrawn.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(50),
        deletedAt: daysAgo(40),
        // `runs_deleted_by_required` CHECK requires deletedBy when deletedAt is set.
        deletedBy: baseFixture.districtAdmin.id,
      });

      const ok = await testRepo.verifyStudentInScope(scope, adminWindow, withdrawn.id);
      expect(ok).toBe(false);
    });

    it('does NOT return true for a student enrolled only in a different district that shares the admin', async () => {
      // Regression guard for the cross-scope leak surfaced in #1792 review.
      // An earlier version routed the "always permits withdrawn-with-data"
      // path through a bare `(userId, administrationId)` EXISTS that didn't
      // know about scope — so a student enrolled in District A who had runs
      // for an admin also assigned to District B would pass a
      // District-B-scoped per-student lookup. The fix routes the predicate
      // through `buildStudentInScopeQuery` so both branches stay
      // scope-gated.
      const admin = await AdministrationFactory.create({
        name: 'verifyStudentInScope — cross-scope leak guard',
        createdBy: baseFixture.districtAdmin.id,
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });
      const districtA = await OrgFactory.create({ orgType: OrgType.DISTRICT, name: 'CrossScopeLeak A' });
      const districtB = await OrgFactory.create({ orgType: OrgType.DISTRICT, name: 'CrossScopeLeak B' });
      await AdministrationOrgFactory.create({ administrationId: admin.id, orgId: districtA.id });
      await AdministrationOrgFactory.create({ administrationId: admin.id, orgId: districtB.id });
      await AdministrationTaskVariantFactory.create({
        administrationId: admin.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        orderIndex: 0,
      });

      const student = await UserFactory.create({ nameLast: 'CrossScopeStudentInA' });
      // Enrollment ONLY in district A.
      await UserOrgFactory.create({
        userId: student.id,
        orgId: districtA.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: null,
      });
      // Qualifying run for the shared admin.
      await RunFactory.create({
        userId: student.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: admin.id,
        useForReporting: true,
        completedAt: daysAgo(50),
      });

      const adminWindow = toReportAdminWindow(admin);

      // Sanity: lookup under district A passes.
      const inA = await testRepo.verifyStudentInScope(
        { scopeType: 'district', scopeId: districtA.id },
        adminWindow,
        student.id,
      );
      expect(inA).toBe(true);

      // The actual regression assertion: must NOT leak across to district B.
      const inB = await testRepo.verifyStudentInScope(
        { scopeType: 'district', scopeId: districtB.id },
        adminWindow,
        student.id,
      );
      expect(inB).toBe(false);
    });

    it('returns false for a rostering-ended student even with a qualifying run (#1742 hard boundary)', async () => {
      // The rostering-ended boundary (#1742) is a harder filter than the
      // enrollment-overlap check (#1792). Even when a student would
      // otherwise pass the withdrawn-with-data path, ended rostering keeps
      // them out — they're decommissioned, not just unenrolled.
      const { adminWindow, scope, district } = await setupIsolatedAdmin({
        name: 'verifyStudentInScope — rostering-ended + run',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const ended = await UserFactory.create({
        nameLast: 'VerifyRosteringEndedWithRun',
        rosteringEnded: daysAgo(1),
      });
      await UserOrgFactory.create({
        userId: ended.id,
        orgId: district.id,
        role: UserRole.STUDENT,
        enrollmentStart: daysAgo(90),
        enrollmentEnd: daysAgo(45),
      });
      await RunFactory.create({
        userId: ended.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: adminWindow.id,
        useForReporting: true,
        completedAt: daysAgo(50),
      });

      const ok = await testRepo.verifyStudentInScope(scope, adminWindow, ended.id);
      expect(ok).toBe(false);
    });
  });

  describe('pagination × includeUnenrolledStudents', () => {
    it('widens totalItems and pages without duplicates when the toggle is on', async () => {
      // Pagination contract under #1792: enabling the toggle monotonically
      // adds rows to the in-scope set (withdrawn-with-data students), so
      // `totalItems` widens and the union of pages must cover both cohorts
      // without duplicating anyone.
      //
      // Setup: 3 strict-overlap students + 2 withdrawn-with-data students
      // under a past admin. perPage = 2 forces 2 pages on toggle-off and
      // 3 on toggle-on; the assertions pin (a) per-page counts, (b)
      // totalItems, (c) deduped union across pages.
      const { adminWindow, scope, district, taskMetas } = await setupIsolatedAdmin({
        name: 'Pagination × toggle',
        dateStart: daysAgo(60),
        dateEnd: daysAgo(30),
      });

      const taskVariantIds = taskMetas.map((t) => t.taskVariantId);

      // 3 strict-overlap students: currently enrolled, no end date, sorted
      // by lastName to keep page order deterministic.
      const strictNames = ['PageStrictA', 'PageStrictB', 'PageStrictC'];
      const strictIds: string[] = [];
      for (const name of strictNames) {
        const user = await UserFactory.create({ nameLast: name });
        strictIds.push(user.id);
        await UserOrgFactory.create({
          userId: user.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(90),
          enrollmentEnd: null,
        });
      }

      // 2 withdrawn-with-data students: left mid-window, completed run for
      // this admin. Strict overlap rejects them; toggle-on accepts.
      const withdrawnNames = ['PageWithdrawnD', 'PageWithdrawnE'];
      const withdrawnIds: string[] = [];
      for (const name of withdrawnNames) {
        const user = await UserFactory.create({ nameLast: name });
        withdrawnIds.push(user.id);
        await UserOrgFactory.create({
          userId: user.id,
          orgId: district.id,
          role: UserRole.STUDENT,
          enrollmentStart: daysAgo(90),
          enrollmentEnd: daysAgo(45),
        });
        await RunFactory.create({
          userId: user.id,
          taskId: baseFixture.task.id,
          taskVariantId: baseFixture.variantForAllGrades.id,
          administrationId: adminWindow.id,
          useForReporting: true,
          completedAt: daysAgo(50),
        });
      }

      const options = { page: 1, perPage: 2 };

      // --- Toggle off: 3 strict-overlap students across 2 pages ---
      const offPage1 = await testRepo.getProgressStudents(
        adminWindow.id,
        scope,
        adminWindow,
        taskVariantIds,
        { ...options, page: 1 },
        undefined,
        undefined,
        undefined,
        false,
      );
      const offPage2 = await testRepo.getProgressStudents(
        adminWindow.id,
        scope,
        adminWindow,
        taskVariantIds,
        { ...options, page: 2 },
        undefined,
        undefined,
        undefined,
        false,
      );

      expect(offPage1.totalItems).toBe(3);
      expect(offPage2.totalItems).toBe(3);
      expect(offPage1.items).toHaveLength(2);
      expect(offPage2.items).toHaveLength(1);

      const offUnion = new Set([...offPage1.items, ...offPage2.items].map((r) => r.userId));
      expect(offUnion.size).toBe(3);
      expect([...offUnion].sort()).toEqual([...strictIds].sort());

      // --- Toggle on: 5 students across 3 pages, no duplicates ---
      const onPage1 = await testRepo.getProgressStudents(
        adminWindow.id,
        scope,
        adminWindow,
        taskVariantIds,
        { ...options, page: 1 },
        undefined,
        undefined,
        undefined,
        true,
      );
      const onPage2 = await testRepo.getProgressStudents(
        adminWindow.id,
        scope,
        adminWindow,
        taskVariantIds,
        { ...options, page: 2 },
        undefined,
        undefined,
        undefined,
        true,
      );
      const onPage3 = await testRepo.getProgressStudents(
        adminWindow.id,
        scope,
        adminWindow,
        taskVariantIds,
        { ...options, page: 3 },
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(onPage1.totalItems).toBe(5);
      expect(onPage2.totalItems).toBe(5);
      expect(onPage3.totalItems).toBe(5);
      expect(onPage1.items).toHaveLength(2);
      expect(onPage2.items).toHaveLength(2);
      expect(onPage3.items).toHaveLength(1);

      const onUnion = new Set([...onPage1.items, ...onPage2.items, ...onPage3.items].map((r) => r.userId));
      expect(onUnion.size).toBe(5);
      expect([...onUnion].sort()).toEqual([...strictIds, ...withdrawnIds].sort());
    });
  });
});
