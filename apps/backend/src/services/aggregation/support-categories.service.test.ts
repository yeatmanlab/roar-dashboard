import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { aggregateSupportCategories } from './support-categories.service';
import type { Administration } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { createMockAdministrationRepository } from '../../test-support/repositories';

vi.mock('../../repositories/administration-task-variant.repository');

describe('aggregateSupportCategories', () => {
  let mockAdministrationRepository: MockedObject<AdministrationRepository>;

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
  });

  describe('Error handling', () => {
    it('throws NOT_FOUND when administration does not exist', async () => {
      mockAdministrationRepository.getById.mockResolvedValue(null);

      await expect(
        aggregateSupportCategories(
          { assignmentId: 'admin-123', districtId: 'district-456' },
          { administrationRepository: mockAdministrationRepository },
        ),
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

      const result = await aggregateSupportCategories(
        { assignmentId: 'admin-123', districtId: 'district-456' },
        { administrationRepository: mockAdministrationRepository },
      );

      expect(result).toBeNull();
    });
  });
});
