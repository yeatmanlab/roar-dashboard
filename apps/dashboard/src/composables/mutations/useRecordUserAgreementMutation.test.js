import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import useRecordUserAgreementMutation from './useRecordUserAgreementMutation';

const mockRecordUserAgreement = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: {
      recordUserAgreement: (...args) => mockRecordUserAgreement(...args),
    },
  }),
}));

describe('useRecordUserAgreementMutation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    mockRecordUserAgreement.mockReset();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.restoreAllMocks();
  });

  it('invalidates /me on a 201 response so the unsigned-agreements queue refreshes', async () => {
    mockRecordUserAgreement.mockResolvedValueOnce({ status: 201, body: { data: { recorded: true } } });
    const invalidateSpy = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockReturnValue({ invalidateQueries: invalidateSpy });

    const [result] = withSetup(() => useRecordUserAgreementMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await result.mutateAsync({ userId: 'u1', agreementVersionId: 'v1' });

    expect(mockRecordUserAgreement).toHaveBeenCalledWith({
      params: { userId: 'u1' },
      body: { agreementVersionId: 'v1' },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
  });

  it('invalidates /me on a 409 Conflict so a stale frontend re-syncs', async () => {
    // 409 means the user has already consented to this version. We treat
    // that as a no-op success: invalidate `/me` so the agreement drops off
    // the queue and the flow can advance.
    mockRecordUserAgreement.mockResolvedValueOnce({
      status: 409,
      body: { error: { code: 'agreement/already-recorded' } },
    });
    const invalidateSpy = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockReturnValue({ invalidateQueries: invalidateSpy });

    const [result] = withSetup(() => useRecordUserAgreementMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ userId: 'u1', agreementVersionId: 'v1' })).rejects.toMatchObject({
      status: 409,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [ME_QUERY_KEY] });
  });

  it('does not invalidate /me on a non-201/409 error', async () => {
    mockRecordUserAgreement.mockResolvedValueOnce({
      status: 500,
      body: { error: { code: 'server-error' } },
    });
    const invalidateSpy = vi.fn();
    vi.spyOn(VueQuery, 'useQueryClient').mockReturnValue({ invalidateQueries: invalidateSpy });

    const [result] = withSetup(() => useRecordUserAgreementMutation(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(result.mutateAsync({ userId: 'u1', agreementVersionId: 'v1' })).rejects.toMatchObject({
      status: 500,
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
