import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchDocById } from '@/helpers/query/utils';
import useDistrictQuery from './useDistrictQuery';

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useDistrictQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters when fetching a specific district', () => {
    const districtId = nanoid();

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictQuery(districtId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['district', districtId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('districts', districtId);
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const districtId = nanoid();
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictQuery(districtId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['district', districtId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });
  });
});