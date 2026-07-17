import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useAdministrationScoreFacetsQuery from './useAdministrationScoreFacetsQuery';
import { ADMINISTRATION_SCORE_FACETS_QUERY_KEY } from '@/constants/queryKeys';

const mockGetScoreFacets = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { scoreReports: { getScoreFacets: mockGetScoreFacets } },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

// Mirrors the real ScoreFacetsResponseSchema shape.
const SUPPORT = { achievedSkill: { count: 3 }, developingSkill: { count: 2 }, needsExtraSupport: { count: 1 } };
const FACETS_RESPONSE = {
  totalStudents: 6,
  computedAt: '2026-06-27T00:00:00.000Z',
  tasks: [
    {
      taskId: '11111111-1111-1111-1111-111111111111',
      taskSlug: 'swr',
      taskName: 'Word',
      orderIndex: 0,
      supportLevelByGrade: [{ grade: '3', totalAssessed: 6, ...SUPPORT }],
      supportLevelBySchool: [],
      scoreBinsByGrade: [
        {
          grade: '3',
          rawScore: [{ binStart: 100, binEnd: 130, count: 6 }],
          percentile: [{ binStart: 0, binEnd: 10, count: 6 }],
        },
      ],
      scoreBinsBySchool: [],
    },
  ],
};

const okResult = () => ({ status: StatusCodes.OK, body: { data: FACETS_RESPONSE } });

describe('useAdministrationScoreFacetsQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetScoreFacets.mockReset();
    mockGetScoreFacets.mockResolvedValue(okResult());
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('calls useQuery with the facets key and a gated, readonly enabled', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    withSetup(() => useAdministrationScoreFacetsQuery(nanoid(), 'district', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(ADMINISTRATION_SCORE_FACETS_QUERY_KEY);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('makes a single (non-paginated) request and unwraps the envelope', async () => {
    const administrationId = nanoid();
    const scopeId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    withSetup(() => useAdministrationScoreFacetsQuery(administrationId, 'school', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];

    // Clear the call count from the auto-run so we can test the manual call
    mockGetScoreFacets.mockClear();

    const result = await queryFn();

    expect(mockGetScoreFacets).toHaveBeenCalledTimes(1);
    expect(mockGetScoreFacets).toHaveBeenCalledWith({
      params: { id: administrationId },
      query: { scopeType: 'school', scopeId },
    });
    expect(result).toEqual(FACETS_RESPONSE);
    expect(result.tasks[0].supportLevelByGrade[0]).toMatchObject({ grade: '3', achievedSkill: { count: 3 } });
  });

  it('throws when the API returns a non-200 status', async () => {
    mockGetScoreFacets.mockResolvedValue({ status: StatusCodes.BAD_REQUEST, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    withSetup(() => useAdministrationScoreFacetsQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 400/);
  });

  it('stays disabled until the access token and scopeId are available', async () => {
    const scopeId = ref(null);
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    withSetup(() => useAdministrationScoreFacetsQuery(nanoid(), 'school', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    authStore.accessToken = 'test-token';
    scopeId.value = nanoid();
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('does not retry terminal auth / rostering-ended errors but retries transient ones up to 3x', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    let retryFn;
    vi.mocked(VueQuery.useQuery).mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationScoreFacetsQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    const networkError = new Error('network down');
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });
});
