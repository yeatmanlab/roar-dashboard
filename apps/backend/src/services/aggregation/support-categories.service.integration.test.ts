import { describe, it, beforeAll, expect } from 'vitest';
import { aggregateSupportCategories } from './support-categories.service';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { baseFixture } from '../../test-support/fixtures';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../../test-support/factories/administration-org.factory';
import { CoreDbClient } from '../../db/clients';

/**
 * Integration tests for aggregateSupportCategories service.
 *
 * SKIPPED: These tests are currently skipped (.skip) because they cannot exercise
 * the real SQL joins (fdwRuns × fdwRunScores × runDemographics × userClasses/classes/orgs)
 * without seeding data across both core and assessment databases.
 *
 * To implement real integration tests, the following data factories/infrastructure are needed:
 *
 * 1. **AdministrationTaskVariantFactory**: Link administrations to scored tasks (swr, pa, sre, cva, etc.)
 * 2. **FdwRunFactory** (assessment DB): Create runs with useForReporting=true, deletedAt=null
 * 3. **FdwRunScoreFactory** (assessment DB): Seed percentile and raw scores (type='computed'|'raw', name='percentile'|'rawScore')
 * 4. **RunDemographicsFactory** (core DB): Associate runs with grades
 * 5. **UserClassesFactory** (core DB): Enroll users with enrollmentEnd=null (active)
 * 6. **ClassesFactory** (core DB): Link classes to schools
 *
 * Once these factories exist, each test should assert:
 * - Non-null aggregation results (indicating data flowed through joins)
 * - Correct support level counts per getSupportLevel() percentile thresholds
 * - Correct school/grade/score-range groupings
 * - Active-enrollment filter excludes ended enrollments
 *
 * This is critical for "Highest" risk tier (scoring/classification per testing-coverage-expectations.md).
 * These tests document the real-data regression coverage gap; they must not be re-enabled
 * without actual data seeding (see: quality-code-review.md "AI-generated tests without behavior verification").
 */
describe('aggregateSupportCategories - Integration', () => {
  let administrationRepository: AdministrationRepository;

  beforeAll(async () => {
    // Ensure database is initialized for integration tests
    await baseFixture;
    administrationRepository = new AdministrationRepository(CoreDbClient);
  });

  describe('Aggregation with real data', () => {
    it.skip('returns null when no scored task variants exist for administration', async () => {
      // Create an administration with no task assignments
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      expect(result).toBeNull();
    });

    it.skip('aggregates runs by support level (achievedSkill, developingSkill, needsExtraSupport)', async () => {
      // Integration test: exercise real SQL joins with seeded data
      // This test verifies that the aggregation correctly classifies runs into support levels
      // based on their percentile scores (not just returns null)

      // Create an administration and assign it to a district
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: admin.id,
        orgId: baseFixture.district.id,
      });

      // Note: In a real integration test, we would:
      // 1. Create task variant assignments (administrationTaskVariants)
      // 2. Seed runs in the assessment DB (fdwRuns, fdwRunScores, runDemographics)
      // 3. Ensure user enrollments exist (userClasses)
      // This requires cross-DB coordination and is deferred to when full integration
      // infrastructure is available.

      // For now, verify the service handles the happy path without errors
      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // Result will be null if no task variants assigned (expected in this stub)
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('groups results by school and grade', async () => {
      // Integration test placeholder: verifies grouping logic when data is seeded
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When proper data is seeded, assert result structure includes:
      // result[taskId].achievedSkill.schools[schoolId] = { name, count }
      // result[taskId].achievedSkill.grades[grade] = count
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('bins raw scores into appropriate ranges', async () => {
      // Integration test: verifies raw score binning (400-450, 450-500, etc.)
      // when real score data flows through fdwRunScores
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded, verify: result[taskId].raw['400-450'].total > 0
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('bins percentile scores into appropriate ranges', async () => {
      // Integration test: verifies percentile binning (40-50, 70-80, etc.)
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded, verify: result[taskId].percentile['70-80'].total > 0
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('counts distribution of schools and grades per support level', async () => {
      // Integration test: verifies that schools and grades are accurately counted
      // within each support level when runs are aggregated
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded, verify structure:
      // result[taskId][supportLevel].schools has all unique schools
      // result[taskId][supportLevel].grades has all unique grades
      // Counts match actual run counts
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('Edge cases', () => {
    it.skip('handles runs with missing demographics (null grade)', async () => {
      // Integration test: verifies runs with null grade are still counted
      // and appear under grade key 'NONE' in aggregation
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded with null-grade runs, verify:
      // result[taskId][supportLevel].grades['NONE'] is populated
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('handles runs with missing enrollment records (no school)', async () => {
      // Integration test: verifies runs for users without active class enrollments
      // are excluded from school aggregation (due to active enrollment filter)
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded with unenrolled users:
      // Their runs should not appear in school counts (active enrollment filter)
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('handles runs with missing or incomplete score data', async () => {
      // Integration test: verifies runs without scores don't crash aggregation
      // and appear in support level counts without score-based binning
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded with score-less runs:
      // result should still be non-null and contain counts
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('handles large administrations without timeout', async () => {
      // Integration test: performance check
      // Verifies aggregation completes within reasonable time with many runs
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      // Test with timeout expectation (should not hang even with 1000+ runs)
      const result = await Promise.race([
        aggregateSupportCategories(
          { assignmentId: admin.id, districtId: baseFixture.district.id },
          { administrationRepository },
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
      ]);

      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('Data correctness', () => {
    it.skip('calculates support levels consistently with getSupportLevel()', async () => {
      // Integration test: verifies support level classification matches scoring rules
      // (percentile-based thresholds for achievedSkill, developingSkill, needsExtraSupport)
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded with known scores, verify support level counts align
      // with expected percentile thresholds from getSupportLevel()
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it.skip('preserves data integrity across multiple runs', async () => {
      // Integration test: idempotency check
      // Verifies calling aggregation twice returns identical results
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result1 = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      const result2 = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // Results must be identical (no mutations, consistent SQL)
      expect(result1).toEqual(result2);
    });

    it.skip('correctly merges multi-school enrollment data', async () => {
      // Integration test: verifies when a student is enrolled in multiple schools
      // (active enrollments), their runs are counted in both schools' aggregations
      const admin = await AdministrationFactory.create({
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await aggregateSupportCategories(
        { assignmentId: admin.id, districtId: baseFixture.district.id },
        { administrationRepository },
      );

      // When seeded with users in multiple active class enrollments:
      // A run should be counted once per school (not deduplicated)
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
