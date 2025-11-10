import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import useUpsertAdministrationMutation from './useUpsertAdministrationMutation';

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

describe('useUpsertAdministrationMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  const mockAdministrationData = {
    name: 'Test Administration',
    publicName: 'Test Admin Public',
    dateOpen: new Date(),
    dateClose: new Date(),
    sequential: true,
    orgs: {
      districts: [nanoid()],
      schools: [],
      classes: [],
      groups: [],
      families: [],
    },
    assessments: [],
    isTestData: false,
    legal: {
      consent: null,
      assent: null,
      amount: '',
      expectedTime: '',
    },
  };

  it('should call createAdministration when the mutation is triggered', async () => {
    const mockAuthStore = { roarfirekit: { createAdministration: vi.fn() } };
    useAuthStore.mockReturnValue(mockAuthStore);

    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync } = result;
    await mutateAsync(mockAdministrationData);

    expect(mockAuthStore.roarfirekit.createAdministration).toHaveBeenCalledWith(mockAdministrationData);
  });

  it('should invalidate administration queries upon mutation success', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockAuthStore = { roarfirekit: { createAdministration: vi.fn() } };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess } = result;
    await mutateAsync(mockAdministrationData);

    expect(isSuccess.value).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administrations'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administrations-list'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administration-assignments'] });
  });

  it('should not invalidate administration queries upon mutation failure', async () => {
    const mockInvalidateQueries = vi.fn();
    const mockError = new Error('Mock error');
    const mockAuthStore = { roarfirekit: { createAdministration: vi.fn(() => Promise.reject(mockError)) } };

    useAuthStore.mockReturnValue(mockAuthStore);

    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess, isError } = result;

    try {
      await mutateAsync(mockAdministrationData);
    } catch (error) {
      expect(error).toBe(mockError);
      expect(isSuccess.value).toBe(false);
      expect(isError.value).toBe(true);
      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    }
  });
});
