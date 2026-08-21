import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { USER_DATA_QUERY_KEY, ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';
import useBulkImportUsersMutation from './useBulkImportUsersMutation';

const mockBulkImport = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { bulkImport: mockBulkImport },
  }),
}));

const mockBody = { users: [{ email: 'student@example.com' }] };

describe('useBulkImportUsersMutation', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    mockBulkImport.mockReset();
  });

  it('calls users.bulkImport with the request body and unwraps the per-row results on 200', async () => {
    const results = [{ index: 0, status: 'ok', classification: 'created' }];
    mockBulkImport.mockResolvedValue({ status: 200, body: { data: { results } } });

    const [result] = withSetup(() => useBulkImportUsersMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync(mockBody);

    expect(mockBulkImport).toHaveBeenCalledWith({ body: mockBody });
    expect(data).toEqual(results);
    expect(result.isSuccess.value).toBe(true);
  });

  it('invalidates user and org-users queries upon mutation success', async () => {
    // useQueryClient() resolves to the plugin-provided client, so spying on the
    // instance avoids mocking the @tanstack/vue-query module itself.
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockBulkImport.mockResolvedValue({ status: 200, body: { data: { results: [] } } });

    const [result] = withSetup(() => useBulkImportUsersMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync(mockBody);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [USER_DATA_QUERY_KEY] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [ORG_USERS_QUERY_KEY] });
  });

  it('throws a structured error and does not invalidate queries on a non-200 response', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockBulkImport.mockResolvedValue({
      status: 400,
      body: { error: { message: 'Malformed request' } },
    });

    const [result] = withSetup(() => useBulkImportUsersMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Capture the rejection so the assertions run unconditionally.
    let thrownError;
    try {
      await result.mutateAsync(mockBody);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({
      status: 400,
      body: { error: { message: 'Malformed request' } },
    });
    expect(result.isError.value).toBe(true);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
