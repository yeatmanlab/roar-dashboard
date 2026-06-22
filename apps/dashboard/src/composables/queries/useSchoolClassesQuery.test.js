import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { SCHOOL_CLASSES_QUERY_KEY } from '@/constants/queryKeys';
import useSchoolClassesQuery from './useSchoolClassesQuery';

const mockListClasses = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    schools: { listClasses: mockListClasses },
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

const SCHOOL_ID = '00000000-0000-0000-0000-0000000000s1';

const classPage = (items, totalPages = 1, page = 1, totalItems = items.length) => ({
  status: 200,
  body: { data: { items, pagination: { page, perPage: 100, totalItems, totalPages } } },
});

describe('useSchoolClassesQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockListClasses.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the SCHOOL_CLASSES_QUERY_KEY and the schoolId ref', () => {
    const schoolId = ref(SCHOOL_ID);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useSchoolClassesQuery(schoolId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [SCHOOL_CLASSES_QUERY_KEY, schoolId],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('requests the school classes and returns the mapped items on a 200', async () => {
    const items = [
      {
        id: '00000000-0000-0000-0000-0000000000c1',
        name: 'Class One',
        schoolId: SCHOOL_ID,
        districtId: '00000000-0000-0000-0000-0000000000d1',
        classType: 'homeroom',
        grades: ['1'],
        courseId: null,
        number: null,
        period: null,
        subjects: null,
        schoolLevels: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: null,
      },
    ];
    mockListClasses.mockResolvedValueOnce(classPage(items));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useSchoolClassesQuery(ref(SCHOOL_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    // mapClassToOrg passes the flat class shape through unchanged.
    expect(result[0].id).toBe(items[0].id);
    expect(result[0].name).toBe('Class One');
    expect(result[0].grades).toEqual(['1']);
    expect(mockListClasses).toHaveBeenCalledWith({
      params: { schoolId: SCHOOL_ID },
      query: { page: 1, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('follows pagination and aggregates all pages', async () => {
    const pageOne = [{ id: '00000000-0000-0000-0000-0000000000c1', name: 'A' }];
    const pageTwo = [{ id: '00000000-0000-0000-0000-0000000000c2', name: 'B' }];
    // Two pages of one item each → a realistic total of 2 (not items.length per page).
    mockListClasses
      .mockResolvedValueOnce(classPage(pageOne, 2, 1, 2))
      .mockResolvedValueOnce(classPage(pageTwo, 2, 2, 2));

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useSchoolClassesQuery(ref(SCHOOL_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((c) => c.id)).toEqual([pageOne[0].id, pageTwo[0].id]);
    expect(mockListClasses).toHaveBeenCalledTimes(2);
    expect(mockListClasses).toHaveBeenNthCalledWith(2, {
      params: { schoolId: SCHOOL_ID },
      query: { page: 2, perPage: 100, sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('throws a structured error on non-200 responses', async () => {
    mockListClasses.mockResolvedValueOnce({ status: 403, body: { error: { code: 'auth/forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useSchoolClassesQuery(ref(SCHOOL_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 403,
      body: { error: { code: 'auth/forbidden' } },
    });
  });

  it('is disabled when the schoolId is not set, and becomes enabled once it is', async () => {
    const schoolId = ref(undefined);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useSchoolClassesQuery(schoolId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    schoolId.value = SCHOOL_ID;
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useSchoolClassesQuery(ref(SCHOOL_ID)), {
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

    withSetup(() => useSchoolClassesQuery(ref(SCHOOL_ID)), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
