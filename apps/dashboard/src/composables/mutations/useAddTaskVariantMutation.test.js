import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import useAddTaskVariantMutation from './useAddTaskVariantMutation';

const mockCreateTaskVariant = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    tasks: { createTaskVariant: mockCreateTaskVariant },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const MOCK_TASK_ID = '00000000-0000-0000-0000-000000000001';
const mockBody = {
  name: 'Variant A',
  status: 'draft',
  parameters: [{ name: 'difficulty', value: 'hard' }],
};

describe('useAddTaskVariantMutation', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    mockCreateTaskVariant.mockReset();
  });

  it('calls tasks.createTaskVariant with the taskId path param and resolves to the created id', async () => {
    const createdVariant = { id: '00000000-0000-0000-0000-000000000002' };
    mockCreateTaskVariant.mockResolvedValue({ status: 201, body: { data: createdVariant } });

    const [result] = withSetup(() => useAddTaskVariantMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ taskId: MOCK_TASK_ID, body: mockBody });

    expect(mockCreateTaskVariant).toHaveBeenCalledWith({ params: { taskId: MOCK_TASK_ID }, body: mockBody });
    expect(data).toEqual(createdVariant);
  });

  it('invalidates the variant queries upon mutation success', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));
    mockCreateTaskVariant.mockResolvedValue({ status: 201, body: { data: { id: 'v1' } } });

    const [result] = withSetup(() => useAddTaskVariantMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ taskId: MOCK_TASK_ID, body: mockBody });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['task-variants'] });
  });

  it('throws a structured error and does not invalidate queries on non-201 responses', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));
    mockCreateTaskVariant.mockResolvedValue({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });

    const [result] = withSetup(() => useAddTaskVariantMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Capture the rejection so the assertions run unconditionally.
    let thrownError;
    try {
      await result.mutateAsync({ taskId: MOCK_TASK_ID, body: mockBody });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });
    expect(result.isError.value).toBe(true);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
