import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { taskFetcher, fetchByTaskId } from '@/helpers/query/tasks';
import useTasksQuery from './useTasksQuery';

vi.mock('@/helpers/query/tasks', () => ({
  taskFetcher: vi.fn().mockImplementation(() => []),
  fetchByTaskId: vi.fn().mockImplementation(() => []),
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

  it('should call query with correct parameters when fetching all tasks', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['tasks'],
      queryFn: expect.any(Function),
    });

    expect(taskFetcher).toHaveBeenCalledWith(false, true);
  });

  it('should call query with correct parameters when fetching registered tasks', () => {
    const fetchRegisteredTasks = true;
    const taskIds = null;
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(fetchRegisteredTasks, taskIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['tasks', 'registered'],
      queryFn: expect.any(Function),
      enabled: true,
    });

    expect(taskFetcher).toHaveBeenCalledWith(true, true);
  });

  it('should call query with correct parameters when fetching specific tasks', () => {
    const fetchRegisteredTasks = false;
    const taskIds = ref(['mock-task-1', 'mock-task-2']);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useTasksQuery(fetchRegisteredTasks, taskIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['tasks', taskIds],
      queryFn: expect.any(Function),
      enabled: true,
    });

    expect(fetchByTaskId).toHaveBeenCalledWith(taskIds);
  });
});
