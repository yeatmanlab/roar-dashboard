import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useTasksDictionaryQuery from './useTasksDictionaryQuery';

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

  describe('useTasksDictionaryQuery', () => {
    it('should return an empty dictionary when data is undefined', () => {
      VueQuery.useQuery.mockReturnValue({
        data: ref(undefined),
        isLoading: ref(false),
        error: ref(null),
      });

      const [result] = withSetup(() => useTasksDictionaryQuery(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      const { data: tasksDictionary } = result;

      expect(tasksDictionary.value).toEqual({});
    });

    it('should return a dictionary of tasks when data is an array', () => {
      const mockData = [
        { id: '1', name: 'Task 1' },
        { id: '2', name: 'Task 2' },
      ];

      VueQuery.useQuery.mockReturnValue({
        data: ref(mockData),
        isLoading: ref(false),
        error: ref(null),
      });

      const [result] = withSetup(() => useTasksDictionaryQuery(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      const { data: tasksDictionary } = result;

      expect(tasksDictionary.value).toEqual({
        1: { id: '1', name: 'Task 1' },
        2: { id: '2', name: 'Task 2' },
      });
    });

    it('should return the query state properties', () => {
      const mockData = [
        { id: '1', name: 'Task 1' },
        { id: '2', name: 'Task 2' },
      ];

      VueQuery.useQuery.mockReturnValue({
        data: ref(mockData),
        isLoading: ref(true),
        error: ref(null),
      });

      const [result] = withSetup(() => useTasksDictionaryQuery(), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      const { data: tasksDictionary, isLoading, error } = result;

      expect(tasksDictionary.value).toEqual({
        1: { id: '1', name: 'Task 1' },
        2: { id: '2', name: 'Task 2' },
      });
      expect(isLoading.value).toBe(true);
      expect(error.value).toBe(null);
    });

    it('should pass queryOptions to the dependent tasks query', () => {
      const queryOptions = { enabled: false, refetchOnWindowFocus: false };
      vi.spyOn(VueQuery, 'useQuery');

      withSetup(() => useTasksDictionaryQuery(queryOptions), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery).toHaveBeenCalledWith(expect.objectContaining(queryOptions));
    });
  });
});
