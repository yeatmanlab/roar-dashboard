import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test-support/withSetup.js';
import * as VueQuery from '@tanstack/vue-query';
import useUpsertAdministrationMutation from './useUpsertAdministrationMutation';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({ administrations: { create: mockCreate, update: mockUpdate } }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const body = {
  name: 'Admin A',
  namePublic: 'Public A',
  dateStart: '2026-01-01T00:00:00.000Z',
  dateEnd: '2026-02-01T00:00:00.000Z',
  isOrdered: false,
  orgs: ['00000000-0000-0000-0000-0000000000d1'],
  classes: [],
  groups: [],
  taskVariants: [{ taskVariantId: '00000000-0000-0000-0000-0000000000a1', orderIndex: 0 }],
  agreements: [],
};

describe('useUpsertAdministrationMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockCreate.mockResolvedValue({ status: 201, body: { data: 'new-admin-id' } });
    mockUpdate.mockResolvedValue({ status: 200, body: { data: { id: 'admin-1' } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    queryClient?.clear();
  });

  it('creates via POST when no administrationId is given', async () => {
    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ body });

    expect(mockCreate).toHaveBeenCalledWith({ body });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(data).toBe('new-admin-id');
  });

  it('updates via PATCH when an administrationId is given', async () => {
    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ administrationId: 'admin-1', body });

    expect(mockUpdate).toHaveBeenCalledWith({ params: { id: 'admin-1' }, body });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(data).toEqual({ id: 'admin-1' });
  });

  it('throws a structured error on a non-2xx response', async () => {
    mockCreate.mockResolvedValueOnce({ status: 422, body: { error: { code: 'validation' } } });

    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ body })).rejects.toMatchObject({
      status: 422,
      body: { error: { code: 'validation' } },
    });
  });

  it('invalidates the administration queries on success', async () => {
    const mockInvalidateQueries = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockImplementation(() => ({ invalidateQueries: mockInvalidateQueries }));

    const [result] = withSetup(() => useUpsertAdministrationMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ body });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administrations-list'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administration-tree'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administration'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administration-assignees'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['administration-task-variants'] });
  });
});
