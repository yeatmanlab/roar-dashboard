import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { getRoarApiClient } from '@/clients/roar-api';
import useDistrictSupportCategoriesQuery from './useDistrictSupportCategoriesQuery';

const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@/clients/roar-api');

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useDistrictSupportCategoriesQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    vi.clearAllMocks();
  });

  it('should call the aggregateSupportCategories endpoint', () => {
    const districtId = nanoid();
    const administrationId = nanoid();

    const mockClient = {
      administrations: {
        aggregateSupportCategories: vi.fn().mockResolvedValue({ data: {} }),
      },
    };

    vi.mocked(getRoarApiClient).mockReturnValue(mockClient);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSupportCategoriesQuery(districtId, administrationId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalled();
  });

  it('should disable query when IDs are not provided', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSupportCategoriesQuery(null, null), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const callArgs = vi.mocked(VueQuery.useQuery).mock.calls[0]?.[0];
    expect(callArgs?.enabled?.value).toBe(false);
  });
});
