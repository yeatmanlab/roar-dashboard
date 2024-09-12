import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchDocById } from '@/helpers/query/utils';
import useFamilyQuery from './useFamilyQuery';

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

describe('useFamilyQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters when fetching a specific family', () => {
    const familyId = nanoid();

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamilyQuery(familyId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['family', familyId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('families', familyId);
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const familyId = nanoid();
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamilyQuery(familyId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['family', familyId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });
  });
});
