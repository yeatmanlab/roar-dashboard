import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { ref, nextTick } from 'vue';
import { withSetup } from '@/test-support/withSetup.js';
import { getActivationCodesByOrgId } from '@/helpers/query/activationCodes';
import useActivationCodesQuery from './useActivationCodesQuery';
import { ACTIVATION_CODE_QUERY_KEY } from '@/constants/queryKeys';

vi.mock('@/helpers/query/activationCodes', () => ({
  getActivationCodesByOrgId: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useActivationCodesQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should work with both ref and regular string values for orgId', () => {
    const regularOrgId = 'test-org-id';
    const refOrgId = ref('test-org-id-ref');
    vi.spyOn(VueQuery, 'useQuery');

    // Test with regular string
    withSetup(() => useActivationCodesQuery(regularOrgId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, regularOrgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: true }),
    });

    expect(getActivationCodesByOrgId).toHaveBeenCalledWith(regularOrgId);

    // Test with ref
    withSetup(() => useActivationCodesQuery(refOrgId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, refOrgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: true }),
    });

    expect(getActivationCodesByOrgId).toHaveBeenCalledWith(refOrgId);
  });

  it('should disable query when orgId is not a string or is empty', () => {
    const cases = [null, undefined, '', ref(null), ref(undefined), ref('')];
    vi.spyOn(VueQuery, 'useQuery');

    cases.forEach((orgId) => {
      withSetup(() => useActivationCodesQuery(orgId), {
        plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
      });

      expect(VueQuery.useQuery).toHaveBeenCalledWith({
        queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
        queryFn: expect.any(Function),
        enabled: expect.objectContaining({ _value: false }),
      });

      expect(getActivationCodesByOrgId).not.toHaveBeenCalled();
    });
  });

  it('should not override internally computed enabled state with query options', () => {
    const orgId = 'test-org-id';
    const queryOptions = {
      enabled: true,
      staleTime: 5000,
      refetchOnWindowFocus: false,
    };

    vi.spyOn(VueQuery, 'useQuery');

    // Even with enabled: true in options, query should be disabled if orgId is invalid
    withSetup(() => useActivationCodesQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, null],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: false }),
      staleTime: 5000,
      refetchOnWindowFocus: false,
    });

    // With valid orgId, other options should be preserved
    withSetup(() => useActivationCodesQuery(orgId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: true }),
      staleTime: 5000,
      refetchOnWindowFocus: false,
    });
  });

  it('should handle reactive changes to orgId', async () => {
    const orgId = ref(null);
    vi.spyOn(VueQuery, 'useQuery');

    const [, app] = withSetup(() => useActivationCodesQuery(orgId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Initially disabled with null orgId
    expect(VueQuery.useQuery).toHaveBeenLastCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: false }),
    });

    // Update orgId to valid value
    orgId.value = 'test-org-id';
    await nextTick();

    // Should now be enabled
    expect(VueQuery.useQuery).toHaveBeenLastCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: true }),
    });

    // Update orgId back to invalid value
    orgId.value = '';
    await nextTick();

    // Should be disabled again
    expect(VueQuery.useQuery).toHaveBeenLastCalledWith({
      queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({ _value: false }),
    });

    app.unmount();
  });
});
