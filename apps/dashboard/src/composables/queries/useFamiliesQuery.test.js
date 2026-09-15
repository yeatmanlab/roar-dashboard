import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { FAMILIES_QUERY_KEY } from '@/constants/queryKeys';
import useFamiliesQuery from './useFamiliesQuery';

const mockFamiliesGet = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    families: { get: mockFamiliesGet },
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

// `FamilyDetailSchema` is minimal — `{ id, location?, rosteringEnded? }`, with
// NO `name`. The helper mirrors that shape and lets each test add the fields it
// cares about.
const familyOk = (id, extra = {}) => ({
  status: 200,
  body: { data: { id, ...extra } },
});

describe('useFamiliesQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockFamiliesGet.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the FAMILIES_QUERY_KEY and the ids ref', () => {
    const familyIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [FAMILIES_QUERY_KEY, familyIds],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches one family per id, preserving order, and maps the results', async () => {
    const idA = '11111111-1111-1111-1111-111111111111';
    const idB = '22222222-2222-2222-2222-222222222222';
    const familyIds = ref([idA, idB]);

    // Resolve B slower than A to prove order follows the input array, not
    // resolution order. `FamilyDetailSchema.location` is an assembled address
    // OBJECT (like districts/schools/groups), so `mapFamilyToOrg` flattens it;
    // `rosteringEnded` passes through unchanged.
    mockFamiliesGet.mockImplementation(({ params: { familyId } }) => {
      if (familyId === idB) {
        return new Promise((resolve) => setTimeout(() => resolve(familyOk(idB, { location: { city: 'Reno' } })), 5));
      }
      return Promise.resolve(familyOk(idA, { rosteringEnded: '2025-01-01T00:00:00.000Z' }));
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((f) => f.id)).toEqual([idA, idB]);
    // Scalar fields pass through (A) and the location object is flattened (B).
    expect(result[0].rosteringEnded).toBe('2025-01-01T00:00:00.000Z');
    expect(result[1].city).toBe('Reno');
    expect(mockFamiliesGet).toHaveBeenCalledWith({ params: { familyId: idA } });
    expect(mockFamiliesGet).toHaveBeenCalledWith({ params: { familyId: idB } });
  });

  it('throws a structured error when any family lookup is non-200', async () => {
    const familyIds = ref(['11111111-1111-1111-1111-111111111111']);
    mockFamiliesGet.mockResolvedValueOnce({ status: 403, body: { error: { code: 'auth/forbidden' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 403,
      body: { error: { code: 'auth/forbidden' } },
    });
  });

  it('is disabled when the ids array is empty', () => {
    const familyIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('becomes enabled once the ids array is populated', async () => {
    const familyIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    familyIds.value = ['11111111-1111-1111-1111-111111111111'];
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    const familyIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    const familyIds = ref(['11111111-1111-1111-1111-111111111111']);
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useFamiliesQuery(familyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
