import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import useAddTaskMutation from './useAddTaskMutation';

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useAddTaskMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  const mockTask = { id: 'mock-test-task', name: 'Mock Test Task' };

  it('should call registerTaskVariant when the mutation is triggered', async () => {
    const mockAuthStore = { roarfirekit: { registerTaskVariant: vi.fn() } };

    useAuthStore.mockReturnValue(mockAuthStore);

    const [result] = withSetup(() => useAddTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync } = result;
    await mutateAsync(mockTask);

    expect(mockAuthStore.roarfirekit.registerTaskVariant).toHaveBeenCalledWith(mockTask);
  });

  it('should invalidate task queries upon mutation success', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockAuthStore = { roarfirekit: { registerTaskVariant: vi.fn() } };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useAddTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess } = result;
    await mutateAsync(mockTask);

    expect(isSuccess.value).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('should not invalidate task queries upon mutation failure', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockError = new Error('Mock error');
    const mockAuthStore = { roarfirekit: { registerTaskVariant: vi.fn(() => Promise.reject(mockError)) } };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useAddTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess, isError } = result;

    try {
      await mutateAsync(mockTask);
    } catch (error) {
      expect(error).toBe(mockError);
      expect(isSuccess.value).toBe(false);
      expect(isError.value).toBe(true);
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    }
  });
});
