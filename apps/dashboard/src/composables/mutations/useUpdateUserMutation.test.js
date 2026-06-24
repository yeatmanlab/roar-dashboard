import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { USER_DATA_QUERY_KEY, USER_PROFILE_QUERY_KEY } from '@/constants/queryKeys';
import useUpdateUserMutation from './useUpdateUserMutation';

const mockUpdateUser = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { update: mockUpdateUser },
  }),
}));

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const mockBody = { nameFirst: 'Ada', nameLast: 'Lovelace' };

describe('useUpdateUserMutation', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    mockUpdateUser.mockReset();
  });

  it('calls users.update with the path param and body and treats 204 as success', async () => {
    // The contract returns 204 No Content — no body to unwrap.
    mockUpdateUser.mockResolvedValue({ status: 204, body: undefined });

    const [result] = withSetup(() => useUpdateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ userId: MOCK_USER_ID, userData: mockBody });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      params: { id: MOCK_USER_ID },
      body: mockBody,
    });
    expect(data).toBeUndefined();
    expect(result.isSuccess.value).toBe(true);
  });

  it('invalidates both the profile and legacy user queries on success', async () => {
    // useQueryClient() resolves to the plugin-provided client, so spying on the
    // instance avoids mocking the @tanstack/vue-query module itself.
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockUpdateUser.mockResolvedValue({ status: 204, body: undefined });

    const [result] = withSetup(() => useUpdateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ userId: MOCK_USER_ID, userData: mockBody });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [USER_PROFILE_QUERY_KEY] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [USER_DATA_QUERY_KEY] });
  });

  it('throws a structured error and does not invalidate queries on non-204 responses', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockUpdateUser.mockResolvedValue({
      status: 404,
      body: { error: { message: 'Not found' } },
    });

    const [result] = withSetup(() => useUpdateUserMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Capture the rejection so the assertions run unconditionally.
    let thrownError;
    try {
      await result.mutateAsync({ userId: MOCK_USER_ID, userData: mockBody });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({
      status: 404,
      body: { error: { message: 'Not found' } },
    });
    expect(result.isError.value).toBe(true);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
