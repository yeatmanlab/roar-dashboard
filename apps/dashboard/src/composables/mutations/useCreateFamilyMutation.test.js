import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { FAMILIES_QUERY_KEY } from '@/constants/queryKeys';
import useCreateFamilyMutation from './useCreateFamilyMutation';

const mockCreate = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    families: {
      create: (...args) => mockCreate(...args),
    },
  }),
}));

const VALID_BODY = {
  email: 'parent@example.com',
  password: 'super-secret',
  name: { first: 'Pat', last: 'Guardian' },
};

describe('useCreateFamilyMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockCreate.mockReset();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.restoreAllMocks();
  });

  it('returns the family id and invalidates families on a 201', async () => {
    mockCreate.mockResolvedValueOnce({ status: 201, body: { data: { id: 'fam-1' } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const [result] = withSetup(() => useCreateFamilyMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const data = await result.mutateAsync({ body: VALID_BODY });

    expect(data).toEqual({ id: 'fam-1' });
    expect(mockCreate).toHaveBeenCalledWith({ body: VALID_BODY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [FAMILIES_QUERY_KEY] });
  });

  it('throws a structured error carrying status/body on a 409 (email in use)', async () => {
    mockCreate.mockResolvedValueOnce({ status: 409, body: { error: { code: 'conflict' } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const [result] = withSetup(() => useCreateFamilyMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ body: VALID_BODY })).rejects.toMatchObject({
      status: 409,
      body: { error: { code: 'conflict' } },
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('throws a structured error on a 422 (caretaker already has a family)', async () => {
    mockCreate.mockResolvedValueOnce({ status: 422, body: { error: { code: 'unprocessable' } } });

    const [result] = withSetup(() => useCreateFamilyMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ body: VALID_BODY })).rejects.toMatchObject({ status: 422 });
  });

  it('throws a structured error on a 500', async () => {
    mockCreate.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    const [result] = withSetup(() => useCreateFamilyMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ body: VALID_BODY })).rejects.toMatchObject({ status: 500 });
  });
});
