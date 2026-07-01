import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateSupportCategories } from './support-categories.service';
import type { Administration } from '../../db/schema';
import { ApiError } from '../../errors/api-error';

// Mock repositories
const createMockAdministrationRepository = () => ({
  getById: vi.fn(),
});

describe('aggregateSupportCategories', () => {
  let mockAdministrationRepository: ReturnType<typeof createMockAdministrationRepository>;

  beforeEach(() => {
    mockAdministrationRepository = createMockAdministrationRepository();
    vi.clearAllMocks();
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
        dateStart: new Date(),
        dateEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAdministrationRepository.getById.mockResolvedValue(mockAdmin);

      const result = await aggregateSupportCategories(
        { assignmentId: 'admin-123', districtId: 'district-456' },
        { administrationRepository: mockAdministrationRepository },
      );

      expect(result).toEqual({});
    });
  });
});
