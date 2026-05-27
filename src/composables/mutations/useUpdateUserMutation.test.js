import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { SITE_OVERVIEW_QUERY_KEY, USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import useUpdateUserMutation from './useUpdateUserMutation';

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

describe('useUpdateUserMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  const mockUser = {
    userId: 'mock-user-id',
    userData: { email: 'mock-user@stanford.edu' },
  };

  it('should call updateUserData when the mutation is triggered', async () => {
    const mockAuthStore = { roarfirekit: { updateUserData: vi.fn() } };
    useAuthStore.mockReturnValue(mockAuthStore);

    const [result] = withSetup(() => useUpdateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync } = result;
    await mutateAsync(mockUser);

    expect(mockAuthStore.roarfirekit.updateUserData).toHaveBeenCalledWith(mockUser.userId, mockUser.userData);
  });

  it('should invalidate task queries upon mutation success', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockAuthStore = { roarfirekit: { updateUserData: vi.fn() } };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({
      invalidateQueries: mockInvalidateQueries,
    }));

    const [result] = withSetup(() => useUpdateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess } = result;
    await mutateAsync(mockUser);

    expect(isSuccess.value).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [SITE_OVERVIEW_QUERY_KEY] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [USER_DATA_QUERY_KEY] });
  });

  it('should not invalidate task queries upon mutation failure', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockError = new Error('Mock error');
    const mockAuthStore = {
      roarfirekit: { updateUserData: vi.fn(() => Promise.reject(mockError)) },
    };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({
      invalidateQueries: mockInvalidateQueries,
    }));

    const [result] = withSetup(() => useUpdateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess, isError } = result;

    try {
      await mutateAsync(mockUser);
    } catch (error) {
      expect(error).toBe(mockError);
      expect(isSuccess.value).toBe(false);
      expect(isError.value).toBe(true);
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    }
  });
});
