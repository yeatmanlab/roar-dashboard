import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { taskFetcher } from '@/helpers/query/tasks';
import useTasksQuery from './useTasksQuery';

vi.mock('@/helpers/query/tasks', () => ({
  taskFetcher: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useTasksQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call useQuery with correct parameters', () => {
    const fetchRegisteredTasks = false;
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(fetchRegisteredTasks, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['tasks'],
      queryFn: expect.any(Function),
      enabled: false,
    });
  });

  it('should set the alternate query key if fetching registered tasks only', () => {
    const fetchRegisteredTasks = true;
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(fetchRegisteredTasks, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['tasks', 'registered'],
      queryFn: expect.any(Function),
      enabled: false,
    });
  });

  it('should call useTasksQuery with correct parameters', async () => {
    const fetchRegisteredTasks = false;

    withSetup(() => useTasksQuery(fetchRegisteredTasks), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(taskFetcher).toHaveBeenCalledWith(fetchRegisteredTasks, true);
  });
});
