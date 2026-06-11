import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import useAddTaskMutation from './useAddTaskMutation';

const mockTasksCreate = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { create: mockTasksCreate },
  }),
}));

const mockTaskBody = {
  slug: 'mock-task',
  name: 'Mock Task',
  nameSimple: 'ROAR - Mock',
  nameTechnical: 'ROAR - MCK',
  taskConfig: { maxAttempts: 3 },
};

describe('useAddTaskMutation', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    mockTasksCreate.mockReset();
  });

  it('calls tasks.create with the payload as the request body and resolves to the created id', async () => {
    const createdTask = { id: '00000000-0000-0000-0000-000000000001' };
    mockTasksCreate.mockResolvedValue({ status: 201, body: { data: createdTask } });

    const [result] = withSetup(() => useAddTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync(mockTaskBody);

    expect(mockTasksCreate).toHaveBeenCalledWith({ body: mockTaskBody });
    expect(data).toEqual(createdTask);
  });

  it('invalidates the tasks query upon mutation success', async () => {
    // useQueryClient() resolves to the plugin-provided client, so spying on the
    // instance avoids mocking the @tanstack/vue-query module itself.
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockTasksCreate.mockResolvedValue({ status: 201, body: { data: { id: 'task-1' } } });

    const [result] = withSetup(() => useAddTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync(mockTaskBody);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [TASKS_QUERY_KEY] });
  });

  it('throws a structured error and does not invalidate queries on non-201 responses', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    mockTasksCreate.mockResolvedValue({
      status: 409,
      body: { error: { message: 'Conflict' } },
    });

    const [result] = withSetup(() => useAddTaskMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Capture the rejection so the assertions run unconditionally.
    let thrownError;
    try {
      await result.mutateAsync(mockTaskBody);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({
      status: 409,
      body: { error: { message: 'Conflict' } },
    });
    expect(result.isError.value).toBe(true);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
