import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATION_PROGRESS_OVERVIEW_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationProgressOverviewQuery from './useAdministrationProgressOverviewQuery';

const mockGetProgressOverview = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { progressReports: { getProgressOverview: mockGetProgressOverview } },
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

const OVERVIEW = {
  totalStudents: 3,
  studentsWithRequiredTasks: 3,
  studentsAssigned: 1,
  studentsStarted: 1,
  studentsCompleted: 1,
  byTask: [{ taskId: 't1', taskSlug: 'swr', taskName: 'SWR', orderIndex: 0, assigned: 1, started: 1, completed: 1 }],
  computedAt: '2026-06-24T00:00:00.000Z',
  exclusions: { rosteringEnded: 0 },
};

describe('useAdministrationProgressOverviewQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetProgressOverview.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('composes the query key from the overview key, administrationId, and scope', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressOverviewQuery(ADMIN_ID, 'group', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATION_PROGRESS_OVERVIEW_QUERY_KEY, ADMIN_ID, `group-${SCOPE_ID}`],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('sends scope params and unwraps the overview object', async () => {
    mockGetProgressOverview.mockResolvedValue({ status: 200, body: { data: OVERVIEW } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationProgressOverviewQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(OVERVIEW);
    expect(mockGetProgressOverview).toHaveBeenCalledWith({
      params: { id: ADMIN_ID },
      query: { scopeType: 'school', scopeId: SCOPE_ID },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockGetProgressOverview.mockResolvedValue({ status: 400, body: { error: { message: 'Invalid scope' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationProgressOverviewQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 400, body: { error: { message: 'Invalid scope' } } });
  });

  it('is disabled without an access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressOverviewQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('is enabled with a token, administrationId, and full scope', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationProgressOverviewQuery(ADMIN_ID, 'school', SCOPE_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(true);
  });
});
