import { ref, isRef, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchMe, meRetryPolicy } from '@/composables/queries/useMeQuery';
import { deriveClaimsFromMe } from '@/helpers/resolveUserClaims';
import useUserClaimsQuery from './useUserClaimsQuery';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { API_ERROR_CODES } from '@/utils/api-errors';

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: vi.fn(),
}));

vi.mock('@/helpers/resolveUserClaims', () => ({
  deriveClaimsFromMe: vi.fn().mockImplementation((meData) => ({ super_admin: Boolean(meData?.isSuperAdmin) })),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useUserClaimsQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  function setupAuthStore({ accessToken = 'mock-access-token', uid = ref(nanoid()) } = {}) {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = accessToken;
    authStore.uid = uid;
    return { authStore, uid };
  }

  it('delegates to useMeQuery: /me cache entry, fetchMe, and the shared retry policy', () => {
    setupAuthStore();

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.queryKey).toEqual([ME_QUERY_KEY]);
    expect(firstArg.queryFn).toBe(fetchMe);
    expect(firstArg.retry).toBe(meRetryPolicy);
    expect(firstArg.enabled.value).toBe(true);
    expect(isRef(firstArg.enabled)).toBe(true);
  });

  it('selects the { claims } projection from the /me payload', () => {
    setupAuthStore();

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    const meData = { id: nanoid(), isSuperAdmin: true, userType: 'admin' };

    const selected = firstArg.select(meData);

    expect(deriveClaimsFromMe).toHaveBeenCalledWith(meData);
    expect(selected).toEqual({ claims: { super_admin: true } });
  });

  it('short-circuits retries on terminal auth errors and caps transient retries', () => {
    setupAuthStore();

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];

    const terminalError = new Error('/me request failed with status 401');
    terminalError.status = 401;
    terminalError.body = { error: { code: API_ERROR_CODES.AUTH_TOKEN_EXPIRED } };
    expect(firstArg.retry(0, terminalError)).toBe(false);

    const rosteringEndedError = new Error('/me request failed with status 403');
    rosteringEndedError.status = 403;
    rosteringEndedError.body = { error: { code: API_ERROR_CODES.AUTH_ROSTERING_ENDED } };
    expect(firstArg.retry(0, rosteringEndedError)).toBe(false);

    const transientError = new Error('/me request failed with status 500');
    transientError.status = 500;
    expect(firstArg.retry(0, transientError)).toBe(true);
    expect(firstArg.retry(3, transientError)).toBe(false);
  });

  it('is disabled until the access token is available', async () => {
    const { authStore } = setupAuthStore({ accessToken: null });

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.enabled.value).toBe(false);

    authStore.accessToken = 'mock-access-token';
    await nextTick();

    expect(firstArg.enabled.value).toBe(true);
  });

  it('is disabled until the uid is available', async () => {
    const mockUid = ref(null);
    setupAuthStore({ uid: mockUid });

    withSetup(() => useUserClaimsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.enabled.value).toBe(false);

    mockUid.value = nanoid();
    await nextTick();

    expect(firstArg.enabled.value).toBe(true);
  });

  it('honors a caller-supplied enabled option (AND-ed with the internal gate)', async () => {
    setupAuthStore();

    const enableQuery = ref(false);

    withSetup(() => useUserClaimsQuery({ enabled: enableQuery }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.enabled.value).toBe(false);

    enableQuery.value = true;
    await nextTick();

    expect(firstArg.enabled.value).toBe(true);
  });

  it('does not let queryOptions.enabled override the internal gate', () => {
    setupAuthStore({ accessToken: null, uid: ref(null) });

    withSetup(() => useUserClaimsQuery({ enabled: true }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    expect(firstArg.enabled.value).toBe(false);
  });

  it('does not let a caller-supplied select override the { claims } projection', () => {
    // The projection is placed after the queryOptions spread in the
    // delegation to useMeQuery, so it is caller-proof.
    setupAuthStore();
    const callerSelect = vi.fn(() => ({ hijacked: true }));

    withSetup(() => useUserClaimsQuery({ select: callerSelect }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const [firstArg] = VueQuery.useQuery.mock.calls[0];
    const selected = firstArg.select({ id: nanoid(), isSuperAdmin: true, userType: 'admin' });

    expect(selected).toEqual({ claims: { super_admin: true } });
    expect(callerSelect).not.toHaveBeenCalled();
  });
});
