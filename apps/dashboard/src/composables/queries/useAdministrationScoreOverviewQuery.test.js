import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useAdministrationScoreOverviewQuery from './useAdministrationScoreOverviewQuery';
import { ADMINISTRATION_SCORE_OVERVIEW_QUERY_KEY } from '@/constants/queryKeys';

const mockGetOverview = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { scoreReports: { getOverview: mockGetOverview } },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

// Mirrors the real ScoreOverviewResponseSchema shape (taskSlug + supportLevels.<key>.count).
const SAMPLE_OVERVIEW = {
  totalStudents: 10,
  tasks: [
    {
      taskId: '11111111-1111-1111-1111-111111111111',
      taskSlug: 'swr',
      taskName: 'Word',
      orderIndex: 0,
      totalAssessed: 8,
      totalNotAssessed: { required: 1, optional: 1 },
      supportLevels: { needsExtraSupport: { count: 2 }, developingSkill: { count: 3 }, achievedSkill: { count: 3 } },
    },
  ],
  computedAt: '2026-06-28T00:00:00.000Z',
  exclusions: {},
};

describe('useAdministrationScoreOverviewQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetOverview.mockReset();
    mockGetOverview.mockResolvedValue({ status: StatusCodes.OK, body: { data: SAMPLE_OVERVIEW } });
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('calls useQuery with the score-overview key and a gated, readonly enabled', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationScoreOverviewQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(ADMINISTRATION_SCORE_OVERVIEW_QUERY_KEY);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('fetches the overview with the scope params and returns the unwrapped payload', async () => {
    const administrationId = nanoid();
    const scopeId = nanoid();
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationScoreOverviewQuery(administrationId, 'school', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const data = await queryFn();

    expect(mockGetOverview).toHaveBeenCalledWith({
      params: { id: administrationId },
      query: { scopeType: 'school', scopeId },
    });
    expect(data).toEqual(SAMPLE_OVERVIEW);
  });

  it('throws when the API returns a non-200 status', async () => {
    mockGetOverview.mockResolvedValue({ status: StatusCodes.FORBIDDEN, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationScoreOverviewQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 403/);
  });

  it('unwraps a reactive scopeId and stays disabled until it is present', async () => {
    const scopeId = ref(null);
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    withSetup(() => useAdministrationScoreOverviewQuery(nanoid(), 'school', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    scopeId.value = nanoid();
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('stays disabled until the access token is available', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    withSetup(() => useAdministrationScoreOverviewQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    authStore.accessToken = 'test-token';
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('does not retry terminal auth / rostering-ended errors but retries transient ones up to 3x', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationScoreOverviewQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    const networkError = new Error('network down');
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });
});
