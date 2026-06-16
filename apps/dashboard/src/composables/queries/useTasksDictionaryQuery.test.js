import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useTasksDictionaryQuery from './useTasksDictionaryQuery';

const mockTasksList = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { list: mockTasksList },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useTasksDictionaryQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockTasksList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

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

  it('should key each task by both its UUID and its slug', () => {
    const taskSwr = { id: '00000000-0000-0000-0000-000000000001', slug: 'swr', name: 'SWR' };
    const taskPa = { id: '00000000-0000-0000-0000-000000000002', slug: 'pa', name: 'PA' };

    VueQuery.useQuery.mockReturnValue({
      data: ref([taskSwr, taskPa]),
      isLoading: ref(false),
      error: ref(null),
    });

    const [result] = withSetup(() => useTasksDictionaryQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { data: tasksDictionary } = result;

    expect(tasksDictionary.value).toEqual({
      '00000000-0000-0000-0000-000000000001': taskSwr,
      swr: taskSwr,
      '00000000-0000-0000-0000-000000000002': taskPa,
      pa: taskPa,
    });
  });

  it('should return the query state properties', () => {
    VueQuery.useQuery.mockReturnValue({
      data: ref([{ id: '1', slug: 'task-1', name: 'Task 1' }]),
      isLoading: ref(true),
      error: ref(null),
    });

    const [result] = withSetup(() => useTasksDictionaryQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { data: tasksDictionary, isLoading, error } = result;

    expect(tasksDictionary.value).toEqual({
      1: { id: '1', slug: 'task-1', name: 'Task 1' },
      'task-1': { id: '1', slug: 'task-1', name: 'Task 1' },
    });
    expect(isLoading.value).toBe(true);
    expect(error.value).toBe(null);
  });

  it('should pass query options through to the dependent tasks query', () => {
    // `enabled` is consumed by `computeQueryOverrides` (AND'd with the
    // internal access-token gate into a computed ref); the remaining options
    // pass through to useQuery untouched.
    const queryOptions = { enabled: false, refetchOnWindowFocus: false };
    vi.spyOn(VueQuery, 'useQuery').mockReturnValue({
      data: ref(undefined),
      isLoading: ref(false),
      error: ref(null),
    });

    withSetup(() => useTasksDictionaryQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(expect.objectContaining({ refetchOnWindowFocus: false }));

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });
});
