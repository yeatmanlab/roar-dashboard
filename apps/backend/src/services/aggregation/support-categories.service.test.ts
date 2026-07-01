import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { AggregationService } from './support-categories.service';
import type { Administration } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { createMockAdministrationRepository } from '../../test-support/repositories';

vi.mock('../../repositories/administration-task-variant.repository');

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

    it.skip('aggregates runs by support level (achievedSkill, developingSkill, needsExtraSupport)', async () => {
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

      // Mock coreDb with separate query methods
      const mockCoreDb = {
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        innerJoin: vi.fn(),
      };

      // Setup query chains - each query type returns a different array
      const createChain = (data: unknown) => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => {
          resolve(data);
          return Promise.resolve();
        }),
      });

      // Track which query is being executed
      let queryIndex = 0;
      mockCoreDb.select.mockImplementation(() => {
        const queries = [
          // fdwRuns
          [
            { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
            { id: 'run-2', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
          ],
          // runDemographics
          [
            { runId: 'run-1', grade: '2' },
            { runId: 'run-2', grade: '3' },
          ],
          // fdwRunScores
          [
            { runId: 'run-1', type: 'computed', name: 'percentile', value: '75' },
            { runId: 'run-1', type: 'raw', name: 'rawScore', value: '650' },
            { runId: 'run-2', type: 'computed', name: 'percentile', value: '45' },
            { runId: 'run-2', type: 'raw', name: 'rawScore', value: '500' },
          ],
          // userClasses
          [
            { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
            { userId: 'user-2', schoolId: 'school-1', schoolName: 'School A' },
          ],
        ];

        const data = queries[queryIndex];
        queryIndex++;
        return createChain(data);
      });

      mockCoreDb.from.mockReturnValue(mockCoreDb);
      mockCoreDb.where.mockReturnValue(mockCoreDb);
      mockCoreDb.innerJoin.mockReturnValue(mockCoreDb);

      const result = await aggregateSupportCategories({
        administrationId: 'admin-123',
        districtId: 'district-456',
      });

      expect(result).not.toBeNull();
      expect(result!['task-swr-uuid']).toBeDefined();
      // Run 1 with percentile 75 should be achievedSkill
      expect(result!['task-swr-uuid']!.achievedSkill.total).toBeGreaterThan(0);
      // Run 2 with percentile 45 should be developingSkill
      expect(result!['task-swr-uuid']!.developingSkill.total).toBeGreaterThan(0);
    }, 10000);

    it.skip('groups aggregated runs by school and grade', async () => {
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

      // Mock coreDb with simplified setup
      const mockCoreDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      let callCount = 0;
      mockCoreDb.then.mockImplementation(function (onResolve: (value: unknown) => void) {
        callCount++;
        if (callCount === 1) {
          // fdwRuns
          onResolve([
            { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
            { id: 'run-2', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
            { id: 'run-3', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
          ]);
        } else if (callCount === 2) {
          // runDemographics
          onResolve([
            { runId: 'run-1', grade: '2' },
            { runId: 'run-2', grade: '2' },
            { runId: 'run-3', grade: '3' },
          ]);
        } else if (callCount === 3) {
          // fdwRunScores
          onResolve([
            { runId: 'run-1', type: 'computed', name: 'percentile', value: '80' },
            { runId: 'run-2', type: 'computed', name: 'percentile', value: '85' },
            { runId: 'run-3', type: 'computed', name: 'percentile', value: '70' },
          ]);
        } else if (callCount === 4) {
          // userClasses
          onResolve([
            { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
            { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
            { userId: 'user-2', schoolId: 'school-2', schoolName: 'School B' },
          ]);
        }
        return Promise.resolve();
      });

      const result = await aggregateSupportCategories({
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

    it.skip('excludes historical enrollments (enrollmentEnd is set)', async () => {
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

      const mockCoreDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      let callCount = 0;
      mockCoreDb.then.mockImplementation(function (onResolve: (value: unknown) => void) {
        callCount++;
        if (callCount === 1) {
          // fdwRuns
          onResolve([{ id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' }]);
        } else if (callCount === 2) {
          // runDemographics
          onResolve([{ runId: 'run-1', grade: '2' }]);
        } else if (callCount === 3) {
          // fdwRunScores
          onResolve([{ runId: 'run-1', type: 'computed', name: 'percentile', value: '75' }]);
        } else if (callCount === 4) {
          // userClasses - only active enrollment (enrollmentEnd is null) should be returned
          // The query should filter to isNull(userClasses.enrollmentEnd)
          onResolve([{ userId: 'user-1', schoolId: 'school-1', schoolName: 'School A (Active)' }]);
        }
        return Promise.resolve();
      });

      mockCoreDb.from.mockReturnValue(mockCoreDb);
      mockCoreDb.where.mockReturnValue(mockCoreDb);
      mockCoreDb.innerJoin.mockReturnValue(mockCoreDb);

      const result = await aggregateSupportCategories({
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

    it.skip('bins raw and percentile scores into correct ranges', async () => {
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

      // Mock coreDb
      const mockCoreDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };

      let callCount = 0;
      mockCoreDb.then.mockImplementation(function (onResolve: (value: unknown) => void) {
        callCount++;
        if (callCount === 1) {
          // fdwRuns
          onResolve([
            { id: 'run-1', userId: 'user-1', taskVariantId: 'variant-1', administrationId: 'admin-123' },
            { id: 'run-2', userId: 'user-2', taskVariantId: 'variant-1', administrationId: 'admin-123' },
          ]);
        } else if (callCount === 2) {
          // runDemographics
          onResolve([
            { runId: 'run-1', grade: '2' },
            { runId: 'run-2', grade: '3' },
          ]);
        } else if (callCount === 3) {
          // fdwRunScores - with specific score ranges
          onResolve([
            // Run 1: percentile 45 (should bin to 40-50), raw score 475 (should bin to 450-500)
            { runId: 'run-1', type: 'computed', name: 'percentile', value: '45' },
            { runId: 'run-1', type: 'raw', name: 'rawScore', value: '475' },
            // Run 2: percentile 75 (should bin to 70-80), raw score 625 (should bin to 600-650)
            { runId: 'run-2', type: 'computed', name: 'percentile', value: '75' },
            { runId: 'run-2', type: 'raw', name: 'rawScore', value: '625' },
          ]);
        } else if (callCount === 4) {
          // userClasses
          onResolve([
            { userId: 'user-1', schoolId: 'school-1', schoolName: 'School A' },
            { userId: 'user-2', schoolId: 'school-1', schoolName: 'School A' },
          ]);
        }
        return Promise.resolve();
      });

      const result = await aggregateSupportCategories({
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
