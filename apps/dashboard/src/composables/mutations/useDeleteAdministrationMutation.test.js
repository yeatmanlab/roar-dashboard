import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useDeleteAdministrationMutation from './useDeleteAdministrationMutation';

const mockDelete = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { delete: mockDelete } }),
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
    mockDelete.mockReset();
    mockDelete.mockResolvedValue({ status: 204 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  const mockAdministrationId = nanoid();

  it('calls DELETE /administrations/:id when the mutation is triggered', async () => {
    const [result] = withSetup(() => useDeleteAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync(mockAdministrationId);

    expect(mockDelete).toHaveBeenCalledWith({ params: { id: mockAdministrationId } });
  });

  it('invalidates administration queries upon mutation success', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useDeleteAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isSuccess } = result;
    await mutateAsync(mockAdministrationId);

    expect(isSuccess.value).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administrations'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administrations-list'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administration-assignments'] });
  });

  it('throws and does not invalidate on a non-204 response', async () => {
    const mockInvalidateQueries = vi.fn();
    mockDelete.mockResolvedValueOnce({ status: 409, body: { error: { code: 'conflict' } } });
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useDeleteAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { mutateAsync, isError } = result;

    await expect(mutateAsync(mockAdministrationId)).rejects.toMatchObject({ status: 409 });
    expect(isError.value).toBe(true);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
