import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import useUpdateTaskMutation from './useUpdateTaskMutation';

const mockTasksUpdate = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { update: mockTasksUpdate },
  }),
}));

const mockTaskId = '00000000-0000-0000-0000-000000000001';
const mockBody = { nameSimple: 'ROAR - Word v2', taskConfig: { maxAttempts: 5 } };

describe('useUpdateTaskMutation', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    mockTasksUpdate.mockReset();
  });

  it('calls tasks.update with the taskId path param and the diffed body', async () => {
    mockTasksUpdate.mockResolvedValue({ status: 200, body: { data: { id: mockTaskId } } });

    const [result] = withSetup(() => useUpdateTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ taskId: mockTaskId, body: mockBody });

    expect(mockTasksUpdate).toHaveBeenCalledWith({ params: { taskId: mockTaskId }, body: mockBody });
    expect(data).toEqual({ id: mockTaskId });
  });

  it('invalidates the tasks query upon mutation success', async () => {
    // useQueryClient() resolves to the plugin-provided client, so spying on the
    // instance avoids mocking the @tanstack/vue-query module itself.
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockTasksUpdate.mockResolvedValue({ status: 200, body: { data: { id: mockTaskId } } });

    const [result] = withSetup(() => useUpdateTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ taskId: mockTaskId, body: mockBody });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [TASKS_QUERY_KEY] });
  });

  it('throws a structured error and does not invalidate queries on non-200 responses', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockTasksUpdate.mockResolvedValue({
      status: 404,
      body: { error: { message: 'Not found' } },
    });

    const [result] = withSetup(() => useUpdateTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Capture the rejection so the assertions run unconditionally.
    let thrownError;
    try {
      await result.mutateAsync({ taskId: mockTaskId, body: mockBody });
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
