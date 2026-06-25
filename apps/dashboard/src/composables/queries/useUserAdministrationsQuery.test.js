import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { USER_ADMINISTRATIONS_QUERY_KEY } from '@/constants/queryKeys';
import useUserAdministrationsQuery from './useUserAdministrationsQuery';

const mockListUserAdministrations = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { listUserAdministrations: mockListUserAdministrations },
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

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('useUserAdministrationsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockListUserAdministrations.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with a key composed of the administrations key and userId', () => {
    vi.spyOn(VueQuery, 'useQuery');
    const userId = ref(MOCK_USER_ID);

    withSetup(() => useUserAdministrationsQuery(userId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [USER_ADMINISTRATIONS_QUERY_KEY, userId],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the tasks,progress embed and unwraps the items', async () => {
    const items = [{ id: 'admin-1', name: 'Admin 1', tasks: [] }];
    mockListUserAdministrations.mockResolvedValue({
      status: 200,
      body: { data: { items, pagination: { page: 1, perPage: 100, totalItems: 1, totalPages: 1 } } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(items);
    expect(mockListUserAdministrations).toHaveBeenCalledWith({
      params: { userId: MOCK_USER_ID },
      query: { embed: 'tasks,progress', page: 1, perPage: 100 },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: 'admin-1' }];
    const pageTwo = [{ id: 'admin-2' }];
    mockListUserAdministrations
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

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...pageOne, ...pageTwo]);
    expect(mockListUserAdministrations).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListUserAdministrations.mockResolvedValue({
      status: 404,
      body: { error: { message: 'Not found' } },
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { message: 'Not found' } },
    });
  });

  it('does not retry on terminal auth or rostering-ended errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const authRequiredError = { body: { error: { code: 'auth/required' } } };
    const tokenExpiredError = { body: { error: { code: 'auth/token-expired' } } };
    const rosteringEndedError = { body: { error: { code: 'auth/rostering-ended' } } };
    expect(retryFn(0, authRequiredError)).toBe(false);
    expect(retryFn(0, tokenExpiredError)).toBe(false);
    expect(retryFn(0, rosteringEndedError)).toBe(false);
  });

  it('retries up to 3 times on transient errors', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const networkError = new Error('network down');
    expect(retryFn(0, networkError)).toBe(true);
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });

  it('is disabled when no userId is provided, even with a token', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserAdministrationsQuery(ref('')), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is disabled without an access token, even with a userId', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);
  });

  it('is enabled with both a token and a userId', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserAdministrationsQuery(MOCK_USER_ID), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(true);
  });
});
