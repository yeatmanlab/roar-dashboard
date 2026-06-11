import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { fetchTaskGroups } from '@/helpers/query/tasks';
import useTaskBundlesQuery from './useTaskBundlesQuery';

vi.mock('@/helpers/query/tasks', () => ({
  fetchTaskGroups: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useTaskBundlesQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskBundlesQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['task-bundles'],
      queryFn: expect.any(Function),
      enabled: true,
    });

    expect(fetchTaskGroups).toHaveBeenCalledWith();
  });

  it('should not fetch when the query is disabled', () => {
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTaskBundlesQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['task-bundles'],
      queryFn: expect.any(Function),
      enabled: false,
    });

    expect(fetchTaskGroups).not.toHaveBeenCalled();
  });
});
