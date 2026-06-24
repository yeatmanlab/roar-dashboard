import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_PROGRESS_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationProgressQuery from './useAdministrationProgressQuery';

const mockGetStudentProgress = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { progressReports: { getStudentProgress: mockGetStudentProgress } },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const SCOPE_ID = '00000000-0000-0000-0000-000000000002';
const TASKS = [{ taskId: 't1', taskSlug: 'swr', taskName: 'SWR', orderIndex: 0 }];

const buildPage = (items, { page = 1, totalPages = 1 } = {}) => ({
  status: 200,
  body: {
    data: {
      tasks: TASKS,
      items,
      pagination: { page, perPage: 100, totalItems: items.length, totalPages },
      exclusions: { rosteringEnded: 0 },
    },
  },
});

describe('useAdministrationProgressQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetStudentProgress.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('composes the query key from the progress key, administrationId, and scope', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATION_PROGRESS_QUERY_KEY, ADMIN_ID, `school-${SCOPE_ID}`],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('sends scope params and unwraps { students, tasks, exclusions }', async () => {
    const items = [{ user: { userId: 'u1' }, progress: {} }];
    mockGetStudentProgress.mockResolvedValue(buildPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.students).toEqual(items);
    expect(result.tasks).toEqual(TASKS);
    expect(result.exclusions).toEqual({ rosteringEnded: 0 });
    expect(mockGetStudentProgress).toHaveBeenCalledWith({
      params: { id: ADMIN_ID },
      query: { page: 1, perPage: 100, scopeType: 'school', scopeId: SCOPE_ID },
    });
  });

  it('follows pagination and aggregates students across pages', async () => {
    const p1 = [{ user: { userId: 'u1' }, progress: {} }];
    const p2 = [{ user: { userId: 'u2' }, progress: {} }];
    mockGetStudentProgress
      .mockResolvedValueOnce(buildPage(p1, { page: 1, totalPages: 2 }))
      .mockResolvedValueOnce(buildPage(p2, { page: 2, totalPages: 2 }));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'class', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.students).toEqual([...p1, ...p2]);
    expect(mockGetStudentProgress).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGetStudentProgress.mockResolvedValue({ status: 403, body: { error: { message: 'Forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 403, body: { error: { message: 'Forbidden' } } });
  });

  it('does not retry on terminal auth or rostering-ended errors, but retries transient up to 3x', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network'))).toBe(true);
    expect(retryFn(2, new Error('network'))).toBe(true);
    expect(retryFn(3, new Error('network'))).toBe(false);
  });

  it('is disabled without an access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('is disabled when the scope is incomplete', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', ''), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('is enabled with a token, administrationId, and full scope', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(true);
  });
});
