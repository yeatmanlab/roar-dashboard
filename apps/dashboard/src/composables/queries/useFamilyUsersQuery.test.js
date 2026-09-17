import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { FAMILY_USERS_QUERY_KEY } from '@/constants/queryKeys';
import useFamilyUsersQuery from './useFamilyUsersQuery';

const mockListUsers = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    families: { listUsers: mockListUsers },
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

const MOCK_FAMILY_ID = '00000000-0000-0000-0000-0000000000f1';

describe('useFamilyUsersQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockListUsers.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with a key composed of the family-users key, familyId, role and grade', () => {
    vi.spyOn(VueQuery, 'useQuery');
    const familyId = ref(MOCK_FAMILY_ID);
    const role = ref('child');

    withSetup(() => useFamilyUsersQuery(familyId, { role }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [FAMILY_USERS_QUERY_KEY, familyId, role, undefined],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('passes the role filter and unwraps the items', async () => {
    const items = [{ id: 'child-1', nameFirst: 'Kid', roles: ['child'] }];
    mockListUsers.mockResolvedValue({
      status: 200,
      body: { data: { items, pagination: { page: 1, perPage: 100, totalItems: 1, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID, { role: 'child' }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(items);
    expect(mockListUsers).toHaveBeenCalledWith({
      params: { familyId: MOCK_FAMILY_ID },
      query: { page: 1, perPage: 100, role: 'child' },
    });
  });

  it('omits the role and grade filters from the query when not provided', async () => {
    mockListUsers.mockResolvedValue({
      status: 200,
      body: { data: { items: [], pagination: { page: 1, perPage: 100, totalItems: 0, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await queryFn();
    expect(mockListUsers).toHaveBeenCalledWith({
      params: { familyId: MOCK_FAMILY_ID },
      query: { page: 1, perPage: 100 },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: 'child-1' }];
    const pageTwo = [{ id: 'child-2' }];
    mockListUsers
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

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...pageOne, ...pageTwo]);
    expect(mockListUsers).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListUsers.mockResolvedValue({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 403,
      body: { error: { message: 'Forbidden' } },
    });
  });

  it('does not retry on terminal auth or rostering-ended errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/token-expired' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
  });

  it('retries up to 3 times on transient errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const networkError = new Error('network down');
    expect(retryFn(0, networkError)).toBe(true);
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });

  it('is disabled when no familyId is provided, even with a token', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamilyUsersQuery(ref('')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled without an access token, even with a familyId', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled with both a token and a familyId', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamilyUsersQuery(MOCK_FAMILY_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });
});
