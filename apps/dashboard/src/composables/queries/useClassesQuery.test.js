import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { CLASSES_QUERY_KEY } from '@/constants/queryKeys';
import useClassesQuery from './useClassesQuery';

const mockClassesGet = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    classes: { get: mockClassesGet },
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

const classOk = (id, extra = {}) => ({
  status: 200,
  body: { data: { id, name: `Class ${id}`, ...extra } },
});

describe('useClassesQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockClassesGet.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the CLASSES_QUERY_KEY and the ids ref', () => {
    const classIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [CLASSES_QUERY_KEY, classIds],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches one class per id, preserving order, and maps the results', async () => {
    const idA = '11111111-1111-1111-1111-111111111111';
    const idB = '22222222-2222-2222-2222-222222222222';
    const classIds = ref([idA, idB]);

    // Resolve B slower than A to prove order follows the input array, not
    // resolution order. `ClassDetailSchema` is flat — `location` is a plain
    // string room label, not a nested address object, so `mapClassToOrg`
    // passes every field through unchanged.
    mockClassesGet.mockImplementation(({ params: { classId } }) => {
      if (classId === idB) {
        return new Promise((resolve) => setTimeout(() => resolve(classOk(idB, { location: 'Room 101' })), 5));
      }
      return Promise.resolve(classOk(idA, { schoolId: 'school-a', grades: ['5'] }));
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((c) => c.id)).toEqual([idA, idB]);
    // Flat fields and the scalar `location` string pass through unchanged.
    expect(result[0].schoolId).toBe('school-a');
    expect(result[0].grades).toEqual(['5']);
    expect(result[1].location).toBe('Room 101');
    expect(mockClassesGet).toHaveBeenCalledWith({ params: { classId: idA } });
    expect(mockClassesGet).toHaveBeenCalledWith({ params: { classId: idB } });
  });

  it('throws a structured error when any class lookup is non-200', async () => {
    const classIds = ref(['11111111-1111-1111-1111-111111111111']);
    mockClassesGet.mockResolvedValueOnce({ status: 404, body: { error: { code: 'resource/not-found' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { code: 'resource/not-found' } },
    });
  });

  it('is disabled when the ids array is empty', () => {
    const classIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('becomes enabled once the ids array is populated', async () => {
    const classIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    classIds.value = ['11111111-1111-1111-1111-111111111111'];
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    const classIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    const classIds = ref(['11111111-1111-1111-1111-111111111111']);
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useClassesQuery(classIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
