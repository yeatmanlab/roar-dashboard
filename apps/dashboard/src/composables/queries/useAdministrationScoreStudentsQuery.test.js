import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useAdministrationScoreStudentsQuery from './useAdministrationScoreStudentsQuery';
import { ADMINISTRATION_SCORE_STUDENTS_QUERY_KEY } from '@/constants/queryKeys';

const mockListStudents = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { scoreReports: { listStudents: mockListStudents } },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

// Mirrors the real StudentScoresResponseSchema shape.
const TASK_UUID = '11111111-1111-1111-1111-111111111111';
const TASKS = [{ taskId: TASK_UUID, taskSlug: 'swr', taskName: 'Word', orderIndex: 0 }];
const makeRow = (userId) => ({
  user: { userId, firstName: 'A', lastName: 'B', grade: '3' },
  scores: {
    [TASK_UUID]: {
      rawScore: 10,
      percentile: 50,
      standardScore: 100,
      supportLevel: 'achievedSkill',
      reliable: true,
      engagementFlags: [],
      optional: false,
      completed: true,
    },
  },
});
const makePage = (page, totalPages, items) => ({
  status: StatusCodes.OK,
  body: {
    data: { tasks: TASKS, items, pagination: { page, perPage: 100, totalItems: 2, totalPages }, exclusions: {} },
  },
});

describe('useAdministrationScoreStudentsQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockListStudents.mockReset();
    mockListStudents.mockResolvedValue(makePage(1, 1, [makeRow('u1')]));
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('calls useQuery with the student-scores key and a gated, readonly enabled', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationScoreStudentsQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(ADMINISTRATION_SCORE_STUDENTS_QUERY_KEY);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('follows pagination and aggregates all pages into { students, tasks, exclusions }', async () => {
    const administrationId = nanoid();
    const scopeId = nanoid();
    mockListStudents
      .mockResolvedValueOnce(makePage(1, 2, [makeRow('u1')]))
      .mockResolvedValueOnce(makePage(2, 2, [makeRow('u2')]));

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationScoreStudentsQuery(administrationId, 'school', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();

    expect(mockListStudents).toHaveBeenCalledTimes(2);
    expect(mockListStudents).toHaveBeenNthCalledWith(1, {
      params: { id: administrationId },
      query: { page: 1, perPage: 100, scopeType: 'school', scopeId },
    });
    expect(result.students.map((s) => s.user.userId)).toEqual(['u1', 'u2']);
    expect(result.tasks).toEqual(TASKS);
    expect(result.exclusions).toEqual({});
  });

  it('throws when the API returns a non-200 status', async () => {
    mockListStudents.mockResolvedValue({ status: StatusCodes.FORBIDDEN, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationScoreStudentsQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 403/);
  });

  it('stays disabled until the access token and scopeId are available', async () => {
    const scopeId = ref(null);
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    withSetup(() => useAdministrationScoreStudentsQuery(nanoid(), 'school', scopeId), {
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
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationScoreStudentsQuery(nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    const networkError = new Error('network down');
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });
});
