import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import useAdministrationSupportCategoriesQuery from './useAdministrationSupportCategoriesQuery';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';

vi.mock('@tanstack/vue-query');
vi.mock('@/clients/roar-api');
vi.mock('@/store/auth');
vi.mock('@/helpers/computeQueryOverrides', () => ({
  computeQueryOverrides: (conditions, options) => ({
    isQueryEnabled: true,
    options: options || {},
  }),
}));

describe('useAdministrationSupportCategoriesQuery', () => {
  let mockAuthStore;
  let mockApiClient;

  beforeEach(() => {
    mockAuthStore = { accessToken: 'test-token' };
    useAuthStore.mockReturnValue(mockAuthStore);

    mockApiClient = {
      administrations: {
        aggregateSupportCategories: vi.fn(),
      },
    };
    getRoarApiClient.mockReturnValue(mockApiClient);

    vi.clearAllMocks();
  });

  it('returns aggregated support categories on success', async () => {
    const administrationId = 'admin-123';
    const districtId = 'district-456';
    const mockData = {
      swr: {
        achievedSkill: { schools: {}, grades: {}, total: 10 },
        developingSkill: { schools: {}, grades: {}, total: 5 },
        needsExtraSupport: { schools: {}, grades: {}, total: 2 },
        raw: {},
        percentile: {},
      },
    };

    mockApiClient.administrations.aggregateSupportCategories.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: mockData },
    });

    useQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    });

    const result = useAdministrationSupportCategoriesQuery(administrationId, districtId);

    expect(result.data).toEqual(mockData);
  });

  it('handles errors from the API', async () => {
    const administrationId = 'admin-123';
    const districtId = 'district-456';
    const mockError = new Error('API Error');
    mockError.status = StatusCodes.INTERNAL_SERVER_ERROR;
    mockError.body = { error: { message: 'Internal Server Error' } };

    mockApiClient.administrations.aggregateSupportCategories.mockRejectedValue(mockError);

    useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: mockError,
    });

    const result = useAdministrationSupportCategoriesQuery(administrationId, districtId);

    expect(result.error).toEqual(mockError);
  });

  it('gates query on access token and parameters', () => {
    const administrationId = ref('admin-123');
    const districtId = ref('district-456');

    useAdministrationSupportCategoriesQuery(administrationId, districtId);

    expect(useQuery).toHaveBeenCalled();
    const queryConfig = useQuery.mock.calls[0][0];
    expect(queryConfig.queryKey).toContain('administration-support-categories');
  });

  it('uses correct query key with parameters', () => {
    const administrationId = 'admin-123';
    const districtId = 'district-456';

    useAdministrationSupportCategoriesQuery(administrationId, districtId);

    expect(useQuery).toHaveBeenCalled();
    const queryConfig = useQuery.mock.calls[0][0];
    expect(queryConfig.queryKey).toEqual(['administration-support-categories', administrationId, districtId]);
  });
});
