import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { activationCodeFetcher } from '@/helpers/query/activationCodes';
import useActivationCodeQuery from './useActivationCodeQuery';
import { ACTIVATION_CODE_QUERY_KEY } from '@/constants/queryKeys';

vi.mock('@/helpers/query/activationCodes', () => ({
  activationCodeFetcher: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useActivationCodeQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters when orgId is valid', () => {
    const orgId = 'test-org-id';
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useActivationCodeQuery(orgId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: 'always',
    });

    expect(activationCodeFetcher).toHaveBeenCalledWith(orgId);
  });

  it('should disable query when orgId is not a string', () => {
    const orgId = null;
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useActivationCodeQuery(orgId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: 'always',
    });

    expect(activationCodeFetcher).not.toHaveBeenCalled();
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const orgId = 'test-org-id';
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useActivationCodeQuery(orgId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: 'always',
    });

    expect(activationCodeFetcher).not.toHaveBeenCalled();
  });
});
