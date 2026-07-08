import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useAdministrationIndividualScoreReportQuery from './useAdministrationIndividualScoreReportQuery';
import { ADMINISTRATION_INDIVIDUAL_REPORT_QUERY_KEY } from '@/constants/queryKeys';

const mockGetIndividualStudentReport = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { scoreReports: { getIndividualStudentReport: mockGetIndividualStudentReport } },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

// Mirrors the real IndividualStudentReportResponseSchema shape.
const REPORT = {
  student: { userId: nanoid(), firstName: 'A', lastName: 'B', username: 'ab', grade: '3' },
  administration: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Fall 2025',
    dateStart: '2025-09-01T00:00:00.000Z',
    dateEnd: '2025-12-01T00:00:00.000Z',
  },
  tasks: [
    {
      taskId: '22222222-2222-2222-2222-222222222222',
      taskSlug: 'swr',
      taskName: 'Word',
      orderIndex: 0,
      scores: { rawScore: 500, percentile: 50, standardScore: 100 },
      supportLevel: 'achievedSkill',
      reliable: true,
      optional: false,
      completed: true,
      engagementFlags: [],
      tags: [],
      historicalScores: [],
    },
  ],
  completedTaskCount: 1,
  totalTaskCount: 1,
};

const okResult = () => ({ status: StatusCodes.OK, body: { data: REPORT } });

describe('useAdministrationIndividualScoreReportQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetIndividualStudentReport.mockReset();
    mockGetIndividualStudentReport.mockResolvedValue(okResult());
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('calls useQuery with the individual-report key and a gated, readonly enabled', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationIndividualScoreReportQuery(nanoid(), nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(ADMINISTRATION_INDIVIDUAL_REPORT_QUERY_KEY);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('makes a single request with the right params and unwraps the envelope', async () => {
    const administrationId = nanoid();
    const userId = nanoid();
    const scopeId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationIndividualScoreReportQuery(administrationId, userId, 'class', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const result = await queryFn();

    expect(mockGetIndividualStudentReport).toHaveBeenCalledTimes(1);
    expect(mockGetIndividualStudentReport).toHaveBeenCalledWith({
      params: { id: administrationId, userId },
      query: { scopeType: 'class', scopeId },
    });
    expect(result).toEqual(REPORT);
    expect(result.tasks[0].taskSlug).toBe('swr');
  });

  it('throws when the API returns a non-200 status', async () => {
    mockGetIndividualStudentReport.mockResolvedValue({ status: StatusCodes.FORBIDDEN, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationIndividualScoreReportQuery(nanoid(), nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 403/);
  });

  it('stays disabled until the access token, userId, and scopeId are available', async () => {
    const userId = ref(null);
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    withSetup(() => useAdministrationIndividualScoreReportQuery(nanoid(), userId, 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    authStore.accessToken = 'test-token';
    userId.value = nanoid();
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

    withSetup(() => useAdministrationIndividualScoreReportQuery(nanoid(), nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    const networkError = new Error('network down');
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });
});
