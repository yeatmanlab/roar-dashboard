/**
 * Integration tests for ReportRepository FDW queries.
 *
 * These tests verify the data access layer directly — no HTTP stack, no auth.
 * Assessment data is seeded via RunFactory into the assessment DB and queried
 * through the FDW foreign tables in the core DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ReportRepository } from './report.repository';
import type { ReportScope } from './report.repository';
import { baseFixture } from '../test-support/fixtures';
import { RunFactory } from '../test-support/factories/run.factory';

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
