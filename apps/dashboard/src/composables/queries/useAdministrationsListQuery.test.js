import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { ADMINISTRATIONS_LIST_QUERY_KEY } from '@/constants/queryKeys';
import useAdministrationsListQuery from './useAdministrationsListQuery';

const mockAdministrationsList = vi.fn();
// Controllable per-test — defaults to a truthy token so most tests don't have
// to set it up. Override via `mockUseAuthStore.mockReturnValue(...)` to
// exercise the built-in `accessToken` enablement gate.
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

// Ref-like stand-ins for the claims query + derived super-admin flag. Defaults:
// claims loaded, caller is a super admin. Mutate `.value` per test.
const mockUserClaims = { value: { claims: { super_admin: true } } };
const mockIsSuperAdmin = { value: true };

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    administrations: { list: mockAdministrationsList },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@/composables/queries/useUserClaimsQuery', () => ({
  default: () => ({ data: mockUserClaims }),
}));

vi.mock('@/composables/useUserType', () => ({
  default: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useAdministrationsListQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockAdministrationsList.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
    mockUserClaims.value = { claims: { super_admin: true } };
    mockIsSuperAdmin.value = true;
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the ADMINISTRATIONS_LIST_QUERY_KEY', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests stats + tasks for super admins and maps embedded tasks to assessments', async () => {
    const tasks = [
      {
        taskId: '00000000-0000-0000-0000-0000000000aa',
        taskName: 'ROAR - Word',
        variantId: '00000000-0000-0000-0000-0000000000bb',
        variantName: 'default',
        orderIndex: 0,
      },
    ];
    const items = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Admin A',
        publicName: 'Public A',
        dates: {
          start: '2026-01-01T00:00:00.000Z',
          end: '2026-02-01T00:00:00.000Z',
          created: '2025-12-01T00:00:00.000Z',
        },
        isOrdered: false,
        stats: { assigned: 10, started: 5, completed: 2 },
        tasks,
      },
    ];
    mockAdministrationsList.mockResolvedValueOnce({
      status: 200,
      body: { data: { items, pagination: { page: 1, perPage: 100, totalItems: 1, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([{ ...items[0], assessments: tasks }]);
    expect(mockAdministrationsList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 100, sortBy: 'name', sortOrder: 'asc', embed: 'stats,tasks' },
    });
  });

  it('requests only tasks (no stats) for non-super-admins', async () => {
    mockIsSuperAdmin.value = false;
    mockAdministrationsList.mockResolvedValueOnce({
      status: 200,
      body: { data: { items: [], pagination: { page: 1, perPage: 100, totalItems: 0, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await queryFn();
    expect(mockAdministrationsList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 100, sortBy: 'name', sortOrder: 'asc', embed: 'tasks' },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'A', publicName: 'A', dates: {}, isOrdered: false },
    ];
    const pageTwo = [
      { id: '00000000-0000-0000-0000-000000000002', name: 'B', publicName: 'B', dates: {}, isOrdered: false },
    ];
    mockAdministrationsList
      .mockResolvedValueOnce({
        status: 200,
        body: { data: { items: pageOne, pagination: { page: 1, perPage: 100, totalItems: 101, totalPages: 2 } } },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { data: { items: pageTwo, pagination: { page: 2, perPage: 100, totalItems: 101, totalPages: 2 } } },
      });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([
      { ...pageOne[0], assessments: [] },
      { ...pageTwo[0], assessments: [] },
    ]);
    expect(mockAdministrationsList).toHaveBeenCalledTimes(2);
    expect(mockAdministrationsList).toHaveBeenNthCalledWith(2, {
      query: { page: 2, perPage: 100, sortBy: 'name', sortOrder: 'asc', embed: 'stats,tasks' },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockAdministrationsList.mockResolvedValueOnce({
      status: 500,
      body: { error: { code: 'internal', message: 'Internal server error' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 500,
      body: { error: { code: 'internal' } },
    });
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled until user claims have loaded', () => {
    mockUserClaims.value = {};
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useAdministrationsListQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
