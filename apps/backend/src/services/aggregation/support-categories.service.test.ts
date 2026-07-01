import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedObject } from 'vitest';
import { aggregateSupportCategories } from './support-categories.service';
import type { Administration } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { AdministrationRepository } from '../../repositories/administration.repository';
import { createMockAdministrationRepository } from '../../test-support/repositories';

describe('aggregateSupportCategories', () => {
  let mockAdministrationRepository: MockedObject<AdministrationRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdministrationRepository = createMockAdministrationRepository();
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
    it('returns empty object when implementation is stubbed', async () => {
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

      const result = await aggregateSupportCategories(
        { assignmentId: 'admin-123', districtId: 'district-456' },
        { administrationRepository: mockAdministrationRepository },
      );

      expect(result).toEqual({});
    });
  });
});
