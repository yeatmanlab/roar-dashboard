import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { FAMILIES_QUERY_KEY, USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import useAddFamilyChildrenMutation from './useAddFamilyChildrenMutation';

const mockAddChildren = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    families: {
      addChildren: (...args) => mockAddChildren(...args),
    },
  }),
}));

const VALID_BODY = {
  children: [
    {
      email: 'kid@roar-auth.com',
      password: 'super-secret',
      name: { first: 'Kid', last: 'Guardian' },
      dob: '2018-05-04',
      grade: 'Kindergarten',
      activationCode: 'CODE123',
    },
  ],
};

describe('useAddFamilyChildrenMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockAddChildren.mockReset();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.restoreAllMocks();
  });

  it('returns the created child ids and invalidates user/families on a 201', async () => {
    mockAddChildren.mockResolvedValueOnce({ status: 201, body: { data: { ids: ['c1', 'c2'] } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const [result] = withSetup(() => useAddFamilyChildrenMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ familyId: 'fam-1', body: VALID_BODY });

    expect(data).toEqual({ ids: ['c1', 'c2'] });
    expect(mockAddChildren).toHaveBeenCalledWith({ params: { familyId: 'fam-1' }, body: VALID_BODY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [USER_DATA_QUERY_KEY] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [FAMILIES_QUERY_KEY] });
  });

  it('throws a structured error on a 409 (child email in use)', async () => {
    mockAddChildren.mockResolvedValueOnce({ status: 409, body: { error: { code: 'conflict' } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const [result] = withSetup(() => useAddFamilyChildrenMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ familyId: 'fam-1', body: VALID_BODY })).rejects.toMatchObject({ status: 409 });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('throws a structured error on a 422 (bad activation code / size cap)', async () => {
    mockAddChildren.mockResolvedValueOnce({ status: 422, body: { error: { code: 'unprocessable' } } });

    const [result] = withSetup(() => useAddFamilyChildrenMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ familyId: 'fam-1', body: VALID_BODY })).rejects.toMatchObject({ status: 422 });
  });
});
