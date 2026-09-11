import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { DISTRICT_SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';
import useDistrictSchoolsQuery from './useDistrictSchoolsQuery';

const mockListSchools = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { listSchools: mockListSchools },
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

const DISTRICT_ID = '00000000-0000-0000-0000-0000000000d1';

const schoolPage = (items, totalPages = 1, page = 1) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems: items.length, totalPages } } },
});

describe('useDistrictSchoolsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockListSchools.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the DISTRICT_SCHOOLS_QUERY_KEY and the districtId ref', () => {
    const districtId = ref(DISTRICT_ID);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSchoolsQuery(districtId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, districtId],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the district schools and returns the mapped items on a 200', async () => {
    const items = [
      {
        id: '00000000-0000-0000-0000-0000000000s1',
        name: 'School One',
        abbreviation: 'S1',
        orgType: 'school',
        parentOrgId: DISTRICT_ID,
        location: { city: 'Menlo Park' },
        identifiers: { ncesId: 'NCES-S1' },
      },
    ];
    mockListSchools.mockResolvedValueOnce(schoolPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictSchoolsQuery(ref(DISTRICT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    // Consumers read id + name; mapping additionally flattens location/identifiers
    // and surfaces parentOrgId as the legacy flat `districtId` that
    // CreateAdministrator derives the parent district from.
    expect(result[0].id).toBe(items[0].id);
    expect(result[0].name).toBe('School One');
    expect(result[0].city).toBe('Menlo Park');
    expect(result[0].ncesId).toBe('NCES-S1');
    expect(result[0].districtId).toBe(DISTRICT_ID);
    expect(mockListSchools).toHaveBeenCalledWith({
      params: { districtId: DISTRICT_ID },
      query: { page: 1, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: '00000000-0000-0000-0000-0000000000s1', name: 'A' }];
    const pageTwo = [{ id: '00000000-0000-0000-0000-0000000000s2', name: 'B' }];
    mockListSchools.mockResolvedValueOnce(schoolPage(pageOne, 2, 1)).mockResolvedValueOnce(schoolPage(pageTwo, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictSchoolsQuery(ref(DISTRICT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((s) => s.id)).toEqual([pageOne[0].id, pageTwo[0].id]);
    expect(mockListSchools).toHaveBeenCalledTimes(2);
    expect(mockListSchools).toHaveBeenNthCalledWith(2, {
      params: { districtId: DISTRICT_ID },
      query: { page: 2, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListSchools.mockResolvedValueOnce({ status: 403, body: { error: { code: 'auth/forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictSchoolsQuery(ref(DISTRICT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 403,
      body: { error: { code: 'auth/forbidden' } },
    });
  });

  it('is disabled when the districtId is not set, and becomes enabled once it is', async () => {
    const districtId = ref(undefined);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSchoolsQuery(districtId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    districtId.value = DISTRICT_ID;
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSchoolsQuery(ref(DISTRICT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictSchoolsQuery(ref(DISTRICT_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
