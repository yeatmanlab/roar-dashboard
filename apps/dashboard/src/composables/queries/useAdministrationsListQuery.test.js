import { ref } from 'vue';
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

// Default reactive args used by most tests (page 1, name asc, no search).
const defaultArgs = () => ({
  page: ref(1),
  perPage: ref(25),
  sortBy: ref('name'),
  sortOrder: ref('asc'),
  search: ref(''),
});

const callComposable = (args = defaultArgs(), queryOptions = undefined) =>
  withSetup(
    () => useAdministrationsListQuery(args.page, args.perPage, args.sortBy, args.sortOrder, args.search, queryOptions),
    { plugins: [[VueQuery.VueQueryPlugin, { queryClient }]] },
  );

let queryClient;

describe('useAdministrationsListQuery', () => {
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

  it('keys on the list key plus the page/sort/search inputs (by reference)', () => {
    vi.spyOn(VueQuery, 'useQuery');

    const args = defaultArgs();
    callComposable(args);

    const { queryKey } = VueQuery.useQuery.mock.calls[0][0];
    // [LIST_KEY, isSuperAdmin, page, perPage, sortBy, sortOrder, search]
    expect(queryKey[0]).toBe(ADMINISTRATIONS_LIST_QUERY_KEY);
    // The reactive inputs are included by reference so the query re-keys when they change.
    expect(queryKey).toContain(args.page);
    expect(queryKey).toContain(args.perPage);
    expect(queryKey).toContain(args.sortBy);
    expect(queryKey).toContain(args.sortOrder);
    expect(queryKey).toContain(args.search);
  });

  it('requests the page/sort/embed query params and returns { items, pagination }', async () => {
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
    const pagination = { page: 2, perPage: 10, totalItems: 12, totalPages: 2 };
    mockAdministrationsList.mockResolvedValueOnce({
      status: 200,
      body: { data: { items, pagination } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    callComposable({
      page: ref(2),
      perPage: ref(10),
      sortBy: ref('dateStart'),
      sortOrder: ref('desc'),
      search: ref(''),
    });

    await expect(queryFn()).resolves.toEqual({
      items: [{ ...items[0], assessments: tasks }],
      pagination,
    });
    expect(mockAdministrationsList).toHaveBeenCalledWith({
      query: { page: 2, perPage: 10, sortBy: 'dateStart', sortOrder: 'desc', embed: 'stats,tasks' },
    });
  });

  it('includes the search term in the query only when it is non-empty', async () => {
    mockAdministrationsList.mockResolvedValue({
      status: 200,
      body: { data: { items: [], pagination: { page: 1, perPage: 25, totalItems: 0, totalPages: 0 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    callComposable({
      page: ref(1),
      perPage: ref(25),
      sortBy: ref('name'),
      sortOrder: ref('asc'),
      search: ref('winter'),
    });

    await queryFn();
    expect(mockAdministrationsList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 25, sortBy: 'name', sortOrder: 'asc', embed: 'stats,tasks', search: 'winter' },
    });
  });

  it('omits the search param when the term is empty', async () => {
    mockAdministrationsList.mockResolvedValue({
      status: 200,
      body: { data: { items: [], pagination: { page: 1, perPage: 25, totalItems: 0, totalPages: 0 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    callComposable();

    await queryFn();
    const callArg = mockAdministrationsList.mock.calls[0][0];
    expect(callArg.query).not.toHaveProperty('search');
  });

  it('requests only tasks (no stats) for non-super-admins', async () => {
    mockIsSuperAdmin.value = false;
    mockAdministrationsList.mockResolvedValueOnce({
      status: 200,
      body: { data: { items: [], pagination: { page: 1, perPage: 25, totalItems: 0, totalPages: 0 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    callComposable();

    await queryFn();
    expect(mockAdministrationsList).toHaveBeenCalledWith({
      query: { page: 1, perPage: 25, sortBy: 'name', sortOrder: 'asc', embed: 'tasks' },
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

    callComposable();

    await expect(queryFn()).rejects.toMatchObject({
      status: 500,
      body: { error: { code: 'internal' } },
    });
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    callComposable();

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled until user claims have loaded', () => {
    mockUserClaims.value = {};
    vi.spyOn(VueQuery, 'useQuery');

    callComposable();

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    callComposable();

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
