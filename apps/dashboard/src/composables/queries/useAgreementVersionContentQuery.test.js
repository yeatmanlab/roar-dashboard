import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { AGREEMENT_VERSION_CONTENT_QUERY_KEY } from '@/constants/queryKeys';
import useAgreementVersionContentQuery from './useAgreementVersionContentQuery';

const mockGetVersionContent = vi.fn();
vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    agreements: {
      getVersionContent: (...args) => mockGetVersionContent(...args),
    },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useAgreementVersionContentQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockGetVersionContent.mockReset();
  });

  afterEach(() => {
    queryClient?.clear();
    vi.restoreAllMocks();
  });

  it('is disabled when agreementId is missing', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAgreementVersionContentQuery(ref(null), ref('v1')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);
  });

  it('is disabled when versionId is missing', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAgreementVersionContentQuery(ref('a1'), ref(null)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);
  });

  it('is enabled when both ids are present', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAgreementVersionContentQuery(ref('a1'), ref('v1')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(true);
  });

  it('uses the AGREEMENT_VERSION_CONTENT_QUERY_KEY plus both ids as the cache key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    const agreementId = ref('a1');
    const versionId = ref('v1');

    withSetup(() => useAgreementVersionContentQuery(agreementId, versionId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(AGREEMENT_VERSION_CONTENT_QUERY_KEY);
    expect(call.queryKey[1]).toBe(agreementId);
    expect(call.queryKey[2]).toBe(versionId);
  });

  it('returns the data envelope contents on a 200 response', async () => {
    const content = { agreementId: 'a1', versionId: 'v1', content: '# TOS body' };
    mockGetVersionContent.mockResolvedValueOnce({ status: 200, body: { data: content } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null } };
    });

    withSetup(() => useAgreementVersionContentQuery(ref('a1'), ref('v1')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(content);
    expect(mockGetVersionContent).toHaveBeenCalledWith({
      params: { agreementId: 'a1', versionId: 'v1' },
    });
  });

  it('throws on non-200 responses', async () => {
    mockGetVersionContent.mockResolvedValueOnce({
      status: 404,
      body: { error: { code: 'agreement-version/not-found' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null } };
    });

    withSetup(() => useAgreementVersionContentQuery(ref('a1'), ref('v1')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { code: 'agreement-version/not-found' } },
    });
  });
});
