import { ref, type MaybeRefOrGetter } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { createTestingPinia, type TestingPinia } from '@pinia/testing';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { type RoarFirekit } from '@levante-framework/firekit';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { useGetSiteOverviewQuery } from './useGetSiteOverviewQuery';

describe('useGetSiteOverviewQuery', () => {
  let pinia: TestingPinia;
  let queryClient: QueryClient;
  let getSiteOverview: Mock;

  const setFirekit = (firekit: { getSiteOverview: Mock } | null) => {
    const authStore = useAuthStore(pinia);
    authStore.roarfirekit = (firekit ? { ...firekit, initialized: true } : null) as unknown as RoarFirekit;
  };

  const mountQuery = (
    siteId: Parameters<typeof useGetSiteOverviewQuery>[0],
    enabled?: MaybeRefOrGetter<boolean>,
  ): ReturnType<typeof useGetSiteOverviewQuery> => {
    const [result] = withSetup(() => useGetSiteOverviewQuery(siteId, enabled), {
      plugins: [[VueQueryPlugin, { queryClient }]],
    });
    return result;
  };

  beforeEach(() => {
    pinia = createTestingPinia({ stubActions: false });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getSiteOverview = vi.fn().mockResolvedValue({ siteName: 'default' });
    setFirekit({ getSiteOverview });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('fetches the site overview for the given siteId and exposes the result', async () => {
    const payload = { siteName: 'Acme School' };
    getSiteOverview.mockResolvedValueOnce(payload);

    const { data, isSuccess } = mountQuery('site-1');
    await flushPromises();

    expect(getSiteOverview).toHaveBeenCalledTimes(1);
    expect(getSiteOverview).toHaveBeenCalledWith({ siteId: 'site-1' });
    expect(isSuccess.value).toBe(true);
    expect(data.value).toEqual(payload);
  });

  it('refetches when siteId changes and serves the new payload (not stale cache)', async () => {
    const siteId = ref('site-1');
    getSiteOverview.mockResolvedValueOnce({ siteName: 'one' }).mockResolvedValueOnce({ siteName: 'two' });

    const { data } = mountQuery(siteId);
    await flushPromises();
    expect(data.value).toEqual({ siteName: 'one' });

    siteId.value = 'site-2';
    await flushPromises();

    expect(getSiteOverview).toHaveBeenCalledTimes(2);
    expect(getSiteOverview).toHaveBeenLastCalledWith({ siteId: 'site-2' });
    expect(data.value).toEqual({ siteName: 'two' });
  });

  it('waits for siteId to be populated before fetching', async () => {
    const siteId = ref('');
    const { data } = mountQuery(siteId);
    await flushPromises();

    expect(getSiteOverview).not.toHaveBeenCalled();
    expect(data.value).toBeUndefined();

    siteId.value = 'site-late';
    await flushPromises();

    expect(getSiteOverview).toHaveBeenCalledTimes(1);
    expect(getSiteOverview).toHaveBeenCalledWith({ siteId: 'site-late' });
  });

  it('does not fetch while roarfirekit is unavailable, then fetches once it is set', async () => {
    setFirekit(null);

    const { data } = mountQuery('site-1');
    await flushPromises();

    expect(getSiteOverview).not.toHaveBeenCalled();
    expect(data.value).toBeUndefined();

    setFirekit({ getSiteOverview });
    await flushPromises();

    expect(getSiteOverview).toHaveBeenCalledTimes(1);
    expect(getSiteOverview).toHaveBeenCalledWith({ siteId: 'site-1' });
  });

  it('respects a reactive `enabled` argument', async () => {
    const enabled = ref(false);
    const { data } = mountQuery('site-1', enabled);
    await flushPromises();

    expect(getSiteOverview).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();

    expect(getSiteOverview).toHaveBeenCalledTimes(1);
    expect(data.value).toEqual({ siteName: 'default' });
  });

  it('does not let `enabled: true` override the internal preconditions', async () => {
    const { data } = mountQuery('', true);
    await flushPromises();

    expect(getSiteOverview).not.toHaveBeenCalled();
    expect(data.value).toBeUndefined();
  });

  it('surfaces firekit errors through the query state', async () => {
    const error = new Error('firekit boom');
    getSiteOverview.mockRejectedValueOnce(error);

    const { isError, error: queryError } = mountQuery('site-1');
    await flushPromises();

    expect(isError.value).toBe(true);
    expect(queryError.value).toBe(error);
  });
});
