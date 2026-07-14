import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useAdministrationTaskSubscoresQuery from './useAdministrationTaskSubscoresQuery';
import { ADMINISTRATION_TASK_SUBSCORES_QUERY_KEY } from '@/constants/queryKeys';

const mockListTaskSubscores = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { scoreReports: { listTaskSubscores: mockListTaskSubscores } },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

// Mirrors the real TaskSubscoresResponseSchema shape.
const TASK = {
  taskId: '11111111-1111-1111-1111-111111111111',
  taskSlug: 'phonics',
  taskName: 'Phonics',
  orderIndex: 3,
};
const COLUMNS = [
  { key: 'cvc', label: 'CVC' },
  { key: 'totalPercentCorrect', label: 'Total % Correct' },
];
const makeRow = (userId) => ({
  user: { userId, firstName: 'A', lastName: 'B', grade: '3', username: null, email: null },
  subscores: { cvc: '15/19', totalPercentCorrect: 78 },
});
const makePage = (page, totalPages, items) => ({
  status: StatusCodes.OK,
  body: {
    data: {
      task: TASK,
      subscoreColumns: COLUMNS,
      items,
      pagination: { page, perPage: 100, totalItems: 2, totalPages },
    },
  },
});

describe('useAdministrationTaskSubscoresQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockListTaskSubscores.mockReset();
    mockListTaskSubscores.mockResolvedValue(makePage(1, 1, [makeRow('u1')]));
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('calls useQuery with the subscores key and a gated, readonly enabled', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationTaskSubscoresQuery(nanoid(), nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(ADMINISTRATION_TASK_SUBSCORES_QUERY_KEY);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('follows pagination and aggregates into { task, subscoreColumns, students, pagination }', async () => {
    const administrationId = nanoid();
    const taskId = nanoid();
    const scopeId = nanoid();
    mockListTaskSubscores
      .mockResolvedValueOnce(makePage(1, 2, [makeRow('u1')]))
      .mockResolvedValueOnce(makePage(2, 2, [makeRow('u2')]));

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationTaskSubscoresQuery(administrationId, taskId, 'school', scopeId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const result = await queryFn();

    expect(mockListTaskSubscores).toHaveBeenCalledTimes(2);
    expect(mockListTaskSubscores).toHaveBeenNthCalledWith(1, {
      params: { id: administrationId, taskId },
      query: { page: 1, perPage: 100, scopeType: 'school', scopeId },
    });
    expect(result.students.map((s) => s.user.userId)).toEqual(['u1', 'u2']);
    expect(result.subscoreColumns).toEqual(COLUMNS);
    expect(result.task).toEqual(TASK);
  });

  it('throws when the API returns a non-200 status', async () => {
    mockListTaskSubscores.mockResolvedValue({ status: StatusCodes.BAD_REQUEST, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationTaskSubscoresQuery(nanoid(), nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 400/);
  });

  it('stays disabled until the access token, taskId, and scopeId are available', async () => {
    const taskId = ref(null);
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = null;

    withSetup(() => useAdministrationTaskSubscoresQuery(nanoid(), taskId, 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    authStore.accessToken = 'test-token';
    taskId.value = nanoid();
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('does not retry terminal auth / rostering-ended / 400 errors but retries transient ones up to 3x', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.accessToken = 'test-token';

    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationTaskSubscoresQuery(nanoid(), nanoid(), 'school', nanoid()), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    // 400 (task without a subscore schema) is terminal.
    expect(retryFn(0, { status: StatusCodes.BAD_REQUEST })).toBe(false);
    const networkError = new Error('network down');
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });
});
