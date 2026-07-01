import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { AggregationService } from './support-categories.service';
import type { Administration } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { AggregationRepository } from '../../repositories/aggregation.repository';
import { createMockAdministrationRepository, createMockAggregationRepository } from '../../test-support/repositories';

vi.mock('../../repositories/administration-task-variant.repository');
vi.mock('../../repositories/aggregation.repository');

describe('aggregateSupportCategories', () => {
  let mockAdministrationRepository: MockedObject<AdministrationRepository>;
  let aggregateSupportCategories: ReturnType<typeof AggregationService>['aggregateSupportCategories'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
    // Mock AdministrationTaskVariantRepository to return empty tasks
    vi.mocked(AdministrationTaskVariantRepository).mockImplementation(
      () =>
        ({
          getByAdministrationIds: vi.fn().mockResolvedValue(new Map()),
        }) as unknown as AdministrationTaskVariantRepository,
    );
    // Mock AggregationRepository to return empty results by default
    vi.mocked(AggregationRepository).mockImplementation(() => createMockAggregationRepository());
    // Create service instance with mocked repositories
    const service = AggregationService({
      administrationRepository: mockAdministrationRepository,
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
      vi.mocked(AdministrationTaskVariantRepository).mockImplementation(
        () =>
          ({
            getByAdministrationIds: vi.fn().mockResolvedValue(new Map()),
          }) as unknown as AdministrationTaskVariantRepository,
      );

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
      vi.mocked(AdministrationTaskVariantRepository).mockImplementation(
        () =>
          ({
            getByAdministrationIds: vi.fn().mockResolvedValue(
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
            ),
          }) as unknown as AdministrationTaskVariantRepository,
      );

      // Mock aggregation repository methods
      const mockAggregationRepo = createMockAggregationRepository();
      mockAggregationRepo.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-2', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepo.getDemographicsByRunIds.mockResolvedValue(
        new Map([
          ['run-1', '2'],
          ['run-2', '3'],
        ]),
      );
      mockAggregationRepo.getScoresByRunIds.mockResolvedValue(
        new Map([
          ['run-1', { percentile: 75, rawScore: 650, scoringVersion: 1 }],
          ['run-2', { percentile: 45, rawScore: 500, scoringVersion: 1 }],
        ]),
      );
      mockAggregationRepo.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
        { userId: 'user-2', schoolId: 'school-1', schoolName: 'School A' },
      ]);
      vi.mocked(AggregationRepository).mockImplementation(() => mockAggregationRepo);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
      });
      const result = await service.aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).not.toBeNull();
      expect(result!['task-swr-uuid']).toBeDefined();
      // Run 1 with percentile 75 (above 70) should be achievedSkill
      expect(result!['task-swr-uuid']!.achievedSkill.total).toBe(1);
      // Run 2 with percentile 45 (40-50 range) should be developingSkill
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
      vi.mocked(AdministrationTaskVariantRepository).mockImplementation(
        () =>
          ({
            getByAdministrationIds: vi.fn().mockResolvedValue(
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
            ),
          }) as unknown as AdministrationTaskVariantRepository,
      );

      // Mock aggregation repository methods
      const mockAggregationRepo = createMockAggregationRepository();
      mockAggregationRepo.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-2', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-3', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepo.getDemographicsByRunIds.mockResolvedValue(
        new Map([
          ['run-1', '2'],
          ['run-2', '2'],
          ['run-3', '3'],
        ]),
      );
      mockAggregationRepo.getScoresByRunIds.mockResolvedValue(
        new Map([
          ['run-1', { percentile: 80, rawScore: null, scoringVersion: 1 }],
          ['run-2', { percentile: 85, rawScore: null, scoringVersion: 1 }],
          ['run-3', { percentile: 70, rawScore: null, scoringVersion: 1 }],
        ]),
      );
      mockAggregationRepo.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
        { userId: 'user-2', schoolId: 'school-2', schoolName: 'School B' },
      ]);
      vi.mocked(AggregationRepository).mockImplementation(() => mockAggregationRepo);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
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

      vi.mocked(AdministrationTaskVariantRepository).mockImplementation(
        () =>
          ({
            getByAdministrationIds: vi.fn().mockResolvedValue(
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
            ),
          }) as unknown as AdministrationTaskVariantRepository,
      );

      const mockAggregationRepo = createMockAggregationRepository();
      mockAggregationRepo.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepo.getDemographicsByRunIds.mockResolvedValue(new Map([['run-1', '2']]));
      mockAggregationRepo.getScoresByRunIds.mockResolvedValue(
        new Map([['run-1', { percentile: 75, rawScore: null, scoringVersion: 1 }]]),
      );
      // Only active enrollment (enrollmentEnd is null) is returned by the repository
      mockAggregationRepo.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A (Active)' },
      ]);
      vi.mocked(AggregationRepository).mockImplementation(() => mockAggregationRepo);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
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
      vi.mocked(AdministrationTaskVariantRepository).mockImplementation(
        () =>
          ({
            getByAdministrationIds: vi.fn().mockResolvedValue(
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
            ),
          }) as unknown as AdministrationTaskVariantRepository,
      );

      const mockAggregationRepo = createMockAggregationRepository();
      mockAggregationRepo.getBestRunsForVariants.mockResolvedValue([
        { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
        { id: 'run-2', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
      ]);
      mockAggregationRepo.getDemographicsByRunIds.mockResolvedValue(
        new Map([
          ['run-1', '2'],
          ['run-2', '3'],
        ]),
      );
      mockAggregationRepo.getScoresByRunIds.mockResolvedValue(
        new Map([
          ['run-1', { percentile: 45, rawScore: 475, scoringVersion: 1 }],
          ['run-2', { percentile: 75, rawScore: 625, scoringVersion: 1 }],
        ]),
      );
      mockAggregationRepo.getUserSchoolsByUserIds.mockResolvedValue([
        { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
        { userId: 'user-2', schoolId: 'school-1', schoolName: 'School A' },
      ]);
      vi.mocked(AggregationRepository).mockImplementation(() => mockAggregationRepo);

      const service = AggregationService({
        administrationRepository: mockAdministrationRepository,
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
      expect(taskCounts.raw).toHaveProperty('450-500');
      expect(taskCounts.raw).toHaveProperty('600-650');
      expect(taskCounts.raw['450-500']!.total).toBe(1);
      expect(taskCounts.raw['600-650']!.total).toBe(1);
    });
  });
});
