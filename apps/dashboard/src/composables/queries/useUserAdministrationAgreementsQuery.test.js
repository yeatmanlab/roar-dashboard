import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { USER_ADMINISTRATION_AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';
import useUserAdministrationAgreementsQuery from './useUserAdministrationAgreementsQuery';

const mockListUserAdministrationAgreements = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { listUserAdministrationAgreements: mockListUserAdministrationAgreements },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return { ...original, useQuery: vi.fn().mockImplementation(original.useQuery) };
});

const USER_ID = '00000000-0000-0000-0000-0000000000aa';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

const agPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useUserAdministrationAgreementsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockListUserAdministrationAgreements.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the user administration agreements query key', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [USER_ADMINISTRATION_AGREEMENTS_QUERY_KEY, expect.anything(), expect.anything()],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the user administration agreements and returns the items on a 200', async () => {
    const items = [
      { id: 'c1', name: 'Consent', agreementType: 'consent', currentVersion: { id: 'v1' }, signed: false },
    ];
    mockListUserAdministrationAgreements.mockResolvedValueOnce(agPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual(items);
    expect(mockListUserAdministrationAgreements).toHaveBeenCalledWith({
      params: { userId: USER_ID, administrationId: ADMIN_ID },
      query: { page: 1, perPage: 100 },
    });
  });

  it('follows pagination across multiple pages', async () => {
    const p1 = [{ id: 'c1', agreementType: 'consent', signed: false }];
    const p2 = [{ id: 'a1', agreementType: 'assent', signed: true }];
    mockListUserAdministrationAgreements
      .mockResolvedValueOnce(agPage(p1, 2, 1))
      .mockResolvedValueOnce(agPage(p2, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).resolves.toEqual([...p1, ...p2]);
    expect(mockListUserAdministrationAgreements).toHaveBeenCalledTimes(2);
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListUserAdministrationAgreements.mockResolvedValueOnce({ status: 500, body: { error: { code: 'internal' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({ status: 500, body: { error: { code: 'internal' } } });
  });

  it('is disabled without a userId', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useUserAdministrationAgreementsQuery(ref(null), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('is disabled without an administrationId', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(null)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('is disabled without an access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('is enabled with a token, userId, and administrationId', () => {
    vi.spyOn(VueQuery, 'useQuery');
    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });
    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(true);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserAdministrationAgreementsQuery(ref(USER_ID), ref(ADMIN_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
