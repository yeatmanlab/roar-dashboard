import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { variantsFetcher } from '@/helpers/query/tasks';
import useTaskVariantsQuery from './useTaskVariantsQuery';

vi.mock('@/helpers/query/tasks', () => ({
  variantsFetcher: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useTasksQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const fetchRegisteredVariants = false;
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantsQuery(fetchRegisteredVariants, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['task-variants'],
      queryFn: expect.any(Function),
      enabled: true,
    });

    expect(variantsFetcher).toHaveBeenCalledWith(fetchRegisteredVariants);
  });

  it('should set the alternate query key if fetching registered variants only', () => {
    const fetchRegisteredVariants = true;
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskVariantsQuery(fetchRegisteredVariants, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['task-variants', 'registered'],
      queryFn: expect.any(Function),
      enabled: false,
    });
  });
});
