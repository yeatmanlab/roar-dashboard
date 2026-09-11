import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import useUpdateTaskVariantMutation from './useUpdateTaskVariantMutation';

const mockUpdateTaskVariant = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { updateTaskVariant: mockUpdateTaskVariant },
  }),
}));

const MOCK_TASK_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_VARIANT_ID = '00000000-0000-0000-0000-000000000002';
const mockBody = { status: 'published', parameters: [{ name: 'difficulty', value: 'easy' }] };

describe('useUpdateTaskVariantMutation', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    mockUpdateTaskVariant.mockReset();
  });

  it('calls tasks.updateTaskVariant with both path params and treats 204 as success', async () => {
    // The contract returns 204 No Content — no body to unwrap.
    mockUpdateTaskVariant.mockResolvedValue({ status: 204, body: undefined });

    const [result] = withSetup(() => useUpdateTaskVariantMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ taskId: MOCK_TASK_ID, variantId: MOCK_VARIANT_ID, body: mockBody });

    expect(mockUpdateTaskVariant).toHaveBeenCalledWith({
      params: { taskId: MOCK_TASK_ID, variantId: MOCK_VARIANT_ID },
      body: mockBody,
    });
    expect(data).toBeUndefined();
    expect(result.isSuccess.value).toBe(true);
  });

  it('invalidates the variant queries upon mutation success', async () => {
    // useQueryClient() resolves to the plugin-provided client, so spying on the
    // instance avoids mocking the @tanstack/vue-query module itself.
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockUpdateTaskVariant.mockResolvedValue({ status: 204, body: undefined });

    const [result] = withSetup(() => useUpdateTaskVariantMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ taskId: MOCK_TASK_ID, variantId: MOCK_VARIANT_ID, body: mockBody });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
  });

  it('throws a structured error and does not invalidate queries on non-204 responses', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockUpdateTaskVariant.mockResolvedValue({
      status: 404,
      body: { error: { message: 'Not found' } },
    });

    const [result] = withSetup(() => useUpdateTaskVariantMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Capture the rejection so the assertions run unconditionally.
    let thrownError;
    try {
      await result.mutateAsync({ taskId: MOCK_TASK_ID, variantId: MOCK_VARIANT_ID, body: mockBody });
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
