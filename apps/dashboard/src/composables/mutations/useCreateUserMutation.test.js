import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useCreateUserMutation from './useCreateUserMutation';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';

const mockCreate = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ users: { create: mockCreate } }),
}));

// Re-export the real module as a plain (configurable) object so the success test
// can `vi.spyOn(VueQuery, 'useQueryClient')` — spying directly on the ESM
// namespace throws. The composable uses the real useMutation / useQueryClient.
vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original };
});

const body = {
  email: 'admin@example.com',
  password: 'super-secret',
  name: { first: 'Ada', last: 'Lovelace' },
  userType: 'admin',
  memberships: [{ entityType: 'district', entityId: '00000000-0000-0000-0000-0000000000d1', role: 'administrator' }],
};

describe('useCreateUserMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ status: 201, body: { data: { id: 'new-user-id' } } });
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient?.clear();
  });

  it('creates via POST /users and returns the created id', async () => {
    const [result] = withSetup(() => useCreateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync(body);

    expect(mockCreate).toHaveBeenCalledWith({ body });
    expect(data).toEqual({ id: 'new-user-id' });
  });

  it('throws a structured error on a non-201 response', async () => {
    mockCreate.mockResolvedValueOnce({ status: 403, body: { error: { code: 'forbidden' } } });

    const [result] = withSetup(() => useCreateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync(body)).rejects.toMatchObject({
      status: 403,
      body: { error: { code: 'forbidden' } },
    });
  });

  it('invalidates the user data query on success', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useCreateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync(body);

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [USER_DATA_QUERY_KEY] });
  });
});
