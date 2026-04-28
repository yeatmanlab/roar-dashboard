/**
 * Integration tests for ReportRepository FDW queries.
 *
 * These tests verify the data access layer directly — no HTTP stack, no auth.
 * Assessment data is seeded via RunFactory into the assessment DB and queried
 * through the FDW foreign tables in the core DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ReportRepository } from './report.repository';
import type { ReportScope, ReportTaskMeta, ProgressOverviewCountsResult } from './report.repository';
import { baseFixture } from '../test-support/fixtures';
import { RunFactory } from '../test-support/factories/run.factory';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationTaskVariantFactory } from '../test-support/factories/administration-task-variant.factory';

let repo: ReportRepository;

/** Default pagination options for tests. */
const defaultOptions = { page: 1, perPage: 25 };

/** Shorthand for the district-scoped administration and its variant IDs. */
let administrationId: string;
let allGradesVariantId: string;
let taskId: string;
let districtScope: ReportScope;

beforeAll(() => {
  repo = new ReportRepository();
  administrationId = baseFixture.administrationAssignedToDistrict.id;
  allGradesVariantId = baseFixture.variantForAllGrades.id;
  taskId = baseFixture.task.id;
  districtScope = { scopeType: 'district', scopeId: baseFixture.district.id };
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
    bulkResult = await bulkRepo.getProgressOverviewCountsBulk(bulkAdminId, [schoolAScope, schoolBScope], bulkTaskMetas);
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
