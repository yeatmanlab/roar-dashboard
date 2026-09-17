import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { AggregationService } from './aggregation.service';
import type { Administration } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { AdministrationRepository } from '../../repositories/administration.repository';
import {
  createMockAdministrationRepository,
  createMockAdministrationTaskVariantRepository,
  createMockAggregationRepository,
  createMockTaskVariantParameterRepository,
} from '../../test-support/repositories';

describe('aggregateSupportCategories', () => {
  let mockAdministrationRepository: MockedObject<AdministrationRepository>;
  let mockAdministrationTaskVariantRepository: ReturnType<typeof createMockAdministrationTaskVariantRepository>;
  let mockAggregationRepository: ReturnType<typeof createMockAggregationRepository>;
  let mockTaskVariantParameterRepository: ReturnType<typeof createMockTaskVariantParameterRepository>;
  let aggregateSupportCategories: ReturnType<typeof AggregationService>['aggregateSupportCategories'];

  /** Sets the variant scoringVersion that raw score buckets are sized from. */
  function setVariantScoringVersion(version: number, variantId = 'variant-1') {
    mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([
      { taskVariantId: variantId, name: 'scoringVersion', value: version, createdAt: new Date(), updatedAt: null },
    ]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    mockTaskVariantParameterRepository = createMockTaskVariantParameterRepository();
    // No scoringVersion rows by default, so every variant resolves to v0.
    mockTaskVariantParameterRepository.getByTaskVariantIds.mockResolvedValue([]);
    // No tasks and no runs by default
    mockAdministrationTaskVariantRepository = createMockAdministrationTaskVariantRepository();
    mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(new Map());
    mockAggregationRepository = createMockAggregationRepository();
    // Create service instance with mocked repositories
    const service = AggregationService({
      administrationRepository: mockAdministrationRepository,
      administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
      aggregationRepository: mockAggregationRepository,
      taskVariantParameterRepository: mockTaskVariantParameterRepository,
    });
    aggregateSupportCategories = service.aggregateSupportCategories;
  });

  describe('Error handling', () => {
    it('throws NOT_FOUND when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      await expect(
        aggregateSupportCategories({
          administrationId: 'admin-123',
          districtId: 'district-456',
        }),
      ).rejects.toThrow(ApiError);
    });
  });

  describe('Scoring config resolution', () => {
    /**
     * Stored score names and support level cutoffs both vary by task, grade, and
     * scoring version, so each run resolves against the scoring config rather than
     * a fixed name or a single set of cutoffs.
     */
    function setupTask(taskSlug: string, runs: Array<{ runId: string; grade: string; scores: [string, string][] }>) {
      mockAdministrationRepository.getById.mockResolvedValue({ id: 'admin-123' } as Administration);
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            'admin-123',
            [
              {
                taskId: `task-${taskSlug}-uuid`,
                taskSlug,
                taskName: taskSlug,
                variantId: 'variant-1',
                variantName: 'Variant A',
                orderIndex: 0,
                conditionsAssignment: null,
                conditionsRequirements: null,
              },
            ],
          ],
        ]),
      );

      mockAggregationRepository.getBestRunsForVariants.mockResolvedValue(
        runs.map((r) => ({
          id: r.runId,
          userId: `user-${r.runId}`,
          taskVariantId: 'variant-1',
          administrationId: 'admin-123',
        })),
      );
      mockAggregationRepository.getDemographicsByRunIds.mockResolvedValue(new Map(runs.map((r) => [r.runId, r.grade])));
      mockAggregationRepository.getScoresByRunIds.mockResolvedValue(
        new Map(runs.map((r) => [r.runId, new Map(r.scores)])),
      );
      mockAggregationRepository.getUserSchoolsByUserIds.mockResolvedValue(
        runs.map((r) => ({ userId: `user-${r.runId}`, schoolId: 'school-1', schoolName: 'School A' })),
      );

      return AggregationService({
        administrationRepository: mockAdministrationRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        aggregationRepository: mockAggregationRepository,
        taskVariantParameterRepository: mockTaskVariantParameterRepository,
      });
    }

    it('resolves the legacy field and cutoffs for pre-v7 swr runs', async () => {
      const service = setupTask('swr', [
        {
          runId: 'run-1',
          grade: '3',
          scores: [
            ['wjPercentile', '45'],
            ['scoringVersion', '6'],
          ],
        },
        {
          runId: 'run-2',
          grade: '3',
          scores: [
            ['wjPercentile', '25'],
            ['scoringVersion', '6'],
          ],
        },
      ]);

      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      const swr = result!['task-swr-uuid']!;
      expect(swr.achievedSkill.total).toBe(0);
      expect(swr.developingSkill.total).toBe(1);
      expect(swr.needsExtraSupport.total).toBe(1);
    });

    it('resolves the current field and cutoffs for v7 swr runs', async () => {
      const service = setupTask('swr', [
        {
          runId: 'run-1',
          grade: '3',
          scores: [
            ['percentile', '45'],
            ['scoringVersion', '7'],
          ],
        },
        {
          runId: 'run-2',
          grade: '3',
          scores: [
            ['percentile', '25'],
            ['scoringVersion', '7'],
          ],
        },
      ]);

      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      const swr = result!['task-swr-uuid']!;
      expect(swr.achievedSkill.total).toBe(1);
      expect(swr.developingSkill.total).toBe(1);
      expect(swr.needsExtraSupport.total).toBe(0);
    });

    it('resolves grade-conditional and task-specific field names', async () => {
      setVariantScoringVersion(3);
      const service = setupTask('pa', [
        {
          runId: 'run-1',
          grade: '8',
          scores: [
            ['sprPercentile', '75'],
            ['roarScore', '56'],
            ['scoringVersion', '3'],
          ],
        },
      ]);

      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      const pa = result!['task-pa-uuid']!;
      expect(pa.achievedSkill.total).toBe(1);
      expect(pa.percentile['70-80']?.total).toBe(1);
      expect(pa.raw['55-57']?.total).toBe(1);
    });

    describe('Raw score buckets', () => {
      function sreRun(percentileName: string, percentile: string, rawScore: string, scoringVersion: string) {
        return [
          {
            runId: 'run-1',
            grade: '3',
            scores: [
              [percentileName, percentile],
              ['sreScore', rawScore],
              ['scoringVersion', scoringVersion],
            ] as [string, string][],
          },
        ];
      }

      it('buckets on the scale of the variant scoring version', async () => {
        setVariantScoringVersion(0);
        const preV5 = await setupTask('sre', sreRun('tosrecPercentile', '60', '120', '0')).aggregateSupportCategories({
          administrationId: 'admin-123',
          districtId: 'district-456',
        });
        expect(preV5!['task-sre-uuid']!.raw['110-120']?.total).toBe(1);

        setVariantScoringVersion(5);
        const v5 = await setupTask('sre', sreRun('percentile', '60', '320', '5')).aggregateSupportCategories({
          administrationId: 'admin-123',
          districtId: 'district-456',
        });
        expect(v5!['task-sre-uuid']!.raw['300-365']?.total).toBe(1);
      });

      it('sizes buckets by the width for the variant scoring version', async () => {
        // Same raw score, two variant versions: pa buckets by 5 at v0 and by 70 at v5.
        const paRun = (percentileName: string, scoringVersion: string) => [
          {
            runId: 'run-1',
            grade: '8',
            scores: [
              [percentileName, '75'],
              ['roarScore', '56'],
              ['scoringVersion', scoringVersion],
            ] as [string, string][],
          },
        ];

        setVariantScoringVersion(0);
        const v0 = await setupTask('pa', paRun('sprPercentile', '3')).aggregateSupportCategories({
          administrationId: 'admin-123',
          districtId: 'district-456',
        });
        expect(Object.keys(v0!['task-pa-uuid']!.raw)).toEqual(['55-57']);

        setVariantScoringVersion(5);
        const v5 = await setupTask('pa', paRun('percentile', '5')).aggregateSupportCategories({
          administrationId: 'admin-123',
          districtId: 'district-456',
        });
        expect(Object.keys(v5!['task-pa-uuid']!.raw)).toEqual(['40-110']);
      });

      it('omits a raw score outside the variant scale, but still counts its support level', async () => {
        setVariantScoringVersion(0);
        const service = setupTask('sre', sreRun('tosrecPercentile', '60', '500', '0'));

        const result = await service.aggregateSupportCategories({
          administrationId: 'admin-123',
          districtId: 'district-456',
        });

        const sre = result!['task-sre-uuid']!;
        expect(sre.raw).toEqual({});
        expect(sre.achievedSkill.total).toBe(1);
      });
    });

    it('aggregates a v1 letter run on the 0-100 scale', async () => {
      setVariantScoringVersion(1);
      const service = setupTask('letter', [
        {
          runId: 'run-1',
          grade: '3',
          scores: [
            ['percentile', '60'],
            ['roarScore', '63'],
            ['scoringVersion', '1'],
          ],
        },
      ]);

      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      const letter = result!['task-letter-uuid']!;
      expect(letter.achievedSkill.total).toBe(1);
      expect(letter.raw['60-70']?.total).toBe(1);
    });

    it('drops a pre-norming (v0) letter run from the chart entirely', async () => {
      setVariantScoringVersion(0);
      const service = setupTask('letter', [
        {
          runId: 'run-1',
          grade: '3',
          scores: [
            ['totalPercentCorrect', '60'],
            ['totalCorrect', '63'],
            ['scoringVersion', '0'],
          ],
        },
      ]);

      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      // Letter has no v0 classification config, so the run has no support level
      // and is excluded from every bucket — support-level counts and histograms alike.
      const letter = result!['task-letter-uuid']!;
      expect(letter.achievedSkill.total).toBe(0);
      expect(letter.developingSkill.total).toBe(0);
      expect(letter.needsExtraSupport.total).toBe(0);
      expect(letter.raw).toEqual({});
      expect(letter.percentile).toEqual({});
    });
  });

  describe('Data aggregation', () => {
    it('returns null when no scored tasks are found', async () => {
      const mockAdmin: Partial<Administration> = {
        id: 'admin-123',
        name: 'Test Admin',
        namePublic: 'Test Admin Public',
        description: 'Test administration',
        dateStart: new Date(),
        dateEnd: new Date(),
        isOrdered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'creator-id',
      };

      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin as Administration);

      // Mock the task variant repository to return empty task list
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(new Map());

      const result = await aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).toBeNull();
    });

    it('aggregates runs by support level (achievedSkill, developingSkill, needsExtraSupport)', async () => {
      const mockAdmin: Partial<Administration> = {
        id: 'admin-123',
        name: 'Test Admin',
        namePublic: 'Test Admin Public',
        description: 'Test administration',
        dateStart: new Date(),
        dateEnd: new Date(),
        isOrdered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'creator-id',
      };

      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin as Administration);

      // Mock task variant repository with one SWR task
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            'admin-123',
            [
              {
                taskId: 'task-swr-uuid',
                taskSlug: 'swr',
                taskName: 'Sight Word Reading',
                variantId: 'variant-1',
                variantName: 'Variant A',
                orderIndex: 0,
                conditionsAssignment: null,
                conditionsRequirements: null,
              },
            ],
          ],
        ]),
      );

      // Mock aggregation repository methods
      mockAggregationRepository.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-2', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepository.getDemographicsByRunIds.mockResolvedValue(
        new Map([
          ['run-1', '2'],
          ['run-2', '3'],
        ]),
      );
      mockAggregationRepository.getScoresByRunIds.mockResolvedValue(
        new Map([
          [
            'run-1',
            new Map([
              ['percentile', '75'],
              ['roarScore', '650'],
              ['scoringVersion', '7'],
            ]),
          ],
          [
            'run-2',
            new Map([
              ['percentile', '35'],
              ['roarScore', '500'],
              ['scoringVersion', '7'],
            ]),
          ],
        ]),
      );
      mockAggregationRepository.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
        { userId: 'user-2', schoolId: 'school-1', schoolName: 'School A' },
      ]);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        aggregationRepository: mockAggregationRepository,
        taskVariantParameterRepository: mockTaskVariantParameterRepository,
      });
      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).not.toBeNull();
      expect(result!['task-swr-uuid']).toBeDefined();
      // v7 cutoffs are 40/20: percentile 75 is achievedSkill
      expect(result!['task-swr-uuid']!.achievedSkill.total).toBe(1);
      // and percentile 35 is developingSkill
      expect(result!['task-swr-uuid']!.developingSkill.total).toBe(1);
      expect(result!['task-swr-uuid']!.needsExtraSupport.total).toBe(0);
    });

    it('groups aggregated runs by school and grade', async () => {
      const mockAdmin: Partial<Administration> = {
        id: 'admin-123',
        name: 'Test Admin',
        namePublic: 'Test Admin Public',
        description: 'Test administration',
        dateStart: new Date(),
        dateEnd: new Date(),
        isOrdered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'creator-id',
      };

      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin as Administration);

      // Mock task variant repository
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            'admin-123',
            [
              {
                taskId: 'task-pa-uuid',
                taskSlug: 'pa',
                taskName: 'Phonological Awareness',
                variantId: 'variant-1',
                variantName: 'Variant A',
                orderIndex: 0,
                conditionsAssignment: null,
                conditionsRequirements: null,
              },
            ],
          ],
        ]),
      );

      // Mock aggregation repository methods
      mockAggregationRepository.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-2', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-3', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepository.getDemographicsByRunIds.mockResolvedValue(
        new Map([
          ['run-1', '2'],
          ['run-2', '2'],
          ['run-3', '3'],
        ]),
      );
      mockAggregationRepository.getScoresByRunIds.mockResolvedValue(
        new Map([
          [
            'run-1',
            new Map([
              ['percentile', '80'],
              ['scoringVersion', '5'],
            ]),
          ],
          [
            'run-2',
            new Map([
              ['percentile', '85'],
              ['scoringVersion', '5'],
            ]),
          ],
          [
            'run-3',
            new Map([
              ['percentile', '70'],
              ['scoringVersion', '5'],
            ]),
          ],
        ]),
      );
      mockAggregationRepository.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
        { userId: 'user-2', schoolId: 'school-2', schoolName: 'School B' },
      ]);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        aggregationRepository: mockAggregationRepository,
        taskVariantParameterRepository: mockTaskVariantParameterRepository,
      });
      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).not.toBeNull();
      const taskCounts = result!['task-pa-uuid']!;
      // Should have grades 2 and 3
      expect(taskCounts.achievedSkill.grades).toHaveProperty('2');
      expect(taskCounts.achievedSkill.grades).toHaveProperty('3');
      // Should have schools
      expect(taskCounts.achievedSkill.schools).toHaveProperty('school-1');
      expect(taskCounts.achievedSkill.schools).toHaveProperty('school-2');
      // School A should have 2 runs (grades 2)
      expect(taskCounts.achievedSkill.schools['school-1']!.count).toBe(2);
      // School B should have 1 run (grade 3)
      expect(taskCounts.achievedSkill.schools['school-2']!.count).toBe(1);
    });

    it('excludes historical enrollments (enrollmentEnd is set)', async () => {
      const mockAdmin: Partial<Administration> = {
        id: 'admin-123',
        name: 'Test Admin',
        namePublic: 'Test Admin Public',
        description: 'Test administration',
        dateStart: new Date(),
        dateEnd: new Date(),
        isOrdered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'creator-id',
      };

      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin as Administration);

      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            'admin-123',
            [
              {
                taskId: 'task-swr-uuid',
                taskSlug: 'swr',
                taskName: 'Sight Word Reading',
                variantId: 'variant-1',
                variantName: 'Variant A',
                orderIndex: 0,
                conditionsAssignment: null,
                conditionsRequirements: null,
              },
            ],
          ],
        ]),
      );

      mockAggregationRepository.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepository.getDemographicsByRunIds.mockResolvedValue(new Map([['run-1', '2']]));
      mockAggregationRepository.getScoresByRunIds.mockResolvedValue(
        new Map([
          [
            'run-1',
            new Map([
              ['percentile', '75'],
              ['scoringVersion', '7'],
            ]),
          ],
        ]),
      );
      // Only active enrollment (enrollmentEnd is null) is returned by the repository
      mockAggregationRepository.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A (Active)' },
      ]);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        aggregationRepository: mockAggregationRepository,
        taskVariantParameterRepository: mockTaskVariantParameterRepository,
      });
      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).not.toBeNull();
      const taskCounts = result!['task-swr-uuid']!;
      // Verify only the active school is included, not historical enrollments
      expect(taskCounts.achievedSkill.schools).toHaveProperty('school-1');
      expect(taskCounts.achievedSkill.schools['school-1']!.name).toBe('School A (Active)');
      expect(taskCounts.achievedSkill.total).toBe(1);
    });

    it('bins raw and percentile scores into correct ranges', async () => {
      const mockAdmin: Partial<Administration> = {
        id: 'admin-123',
        name: 'Test Admin',
        namePublic: 'Test Admin Public',
        description: 'Test administration',
        dateStart: new Date(),
        dateEnd: new Date(),
        isOrdered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'creator-id',
      };

      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin as Administration);

      // Mock task variant repository
      mockAdministrationTaskVariantRepository.getByAdministrationIds.mockResolvedValue(
        new Map([
          [
            'admin-123',
            [
              {
                taskId: 'task-swr-uuid',
                taskSlug: 'swr',
                taskName: 'Sight Word Reading',
                variantId: 'variant-1',
                variantName: 'Variant A',
                orderIndex: 0,
                conditionsAssignment: null,
                conditionsRequirements: null,
              },
            ],
          ],
        ]),
      );

      mockAggregationRepository.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-2', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepository.getDemographicsByRunIds.mockResolvedValue(
        new Map([
          ['run-1', '2'],
          ['run-2', '3'],
        ]),
      );
      mockAggregationRepository.getScoresByRunIds.mockResolvedValue(
        new Map([
          [
            'run-1',
            new Map([
              ['percentile', '45'],
              ['roarScore', '475'],
              ['scoringVersion', '7'],
            ]),
          ],
          [
            'run-2',
            new Map([
              ['percentile', '75'],
              ['roarScore', '625'],
              ['scoringVersion', '7'],
            ]),
          ],
        ]),
      );
      mockAggregationRepository.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
        { userId: 'user-2', schoolId: 'school-1', schoolName: 'School A' },
      ]);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
        administrationTaskVariantRepository: mockAdministrationTaskVariantRepository,
        aggregationRepository: mockAggregationRepository,
        taskVariantParameterRepository: mockTaskVariantParameterRepository,
      });
      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).not.toBeNull();
      const taskCounts = result!['task-swr-uuid']!;

      // Check percentile ranges
      expect(taskCounts.percentile).toHaveProperty('40-50');
      expect(taskCounts.percentile).toHaveProperty('70-80');
      expect(taskCounts.percentile['40-50']!.total).toBe(1);
      expect(taskCounts.percentile['70-80']!.total).toBe(1);

      // Check raw score ranges
      expect(taskCounts.raw).toHaveProperty('400-500');
      expect(taskCounts.raw).toHaveProperty('600-700');
      expect(taskCounts.raw['400-500']!.total).toBe(1);
      expect(taskCounts.raw['600-700']!.total).toBe(1);
    });
  });
});
