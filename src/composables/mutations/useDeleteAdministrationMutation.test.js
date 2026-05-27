import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import {
  ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
  ADMINISTRATIONS_LIST_QUERY_KEY,
  ADMINISTRATIONS_QUERY_KEY,
  SITE_OVERVIEW_QUERY_KEY,
} from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import useDeleteAdministrationMutation from './useDeleteAdministrationMutation';

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

describe('useDeleteAdministrationMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  const mockAdministrationId = nanoid();

  it('should call deleteAdministration when the mutation is triggered', async () => {
    const mockAuthStore = { roarfirekit: { deleteAdministration: vi.fn() } };
    useAuthStore.mockReturnValue(mockAuthStore);

    const [result] = withSetup(() => useDeleteAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync } = result;
    await mutateAsync(mockAdministrationId);

    expect(mockAuthStore.roarfirekit.deleteAdministration).toHaveBeenCalledWith(mockAdministrationId);
  });

  it('should invalidate task queries upon mutation success', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockAuthStore = { roarfirekit: { deleteAdministration: vi.fn() } };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({
      invalidateQueries: mockInvalidateQueries,
    }));

    const [result] = withSetup(() => useDeleteAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess } = result;
    await mutateAsync(mockAdministrationId);

    expect(isSuccess.value).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: [ADMINISTRATIONS_QUERY_KEY],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: [ADMINISTRATION_ASSIGNMENTS_QUERY_KEY],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: [SITE_OVERVIEW_QUERY_KEY],
    });
  });

  it('should not invalidate task queries upon mutation failure', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockError = new Error('Mock error');
    const mockAuthStore = {
      roarfirekit: {
        deleteAdministration: vi.fn(() => Promise.reject(mockError)),
      },
    };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({
      invalidateQueries: mockInvalidateQueries,
    }));

    const [result] = withSetup(() => useDeleteAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess, isError } = result;

    try {
      await mutateAsync(mockAdministrationId);
    } catch (error) {
      expect(error).toBe(mockError);
      expect(isSuccess.value).toBe(false);
      expect(isError.value).toBe(true);
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    }
  });
});
