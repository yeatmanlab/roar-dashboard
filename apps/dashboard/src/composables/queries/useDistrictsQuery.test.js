import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { DISTRICTS_QUERY_KEY } from '@/constants/queryKeys';
import useDistrictsQuery from './useDistrictsQuery';

const mockDistrictsGet = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    districts: { get: mockDistrictsGet },
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

const districtOk = (id, extra = {}) => ({
  status: 200,
  body: { data: { id, name: `District ${id}`, ...extra } },
});

describe('useDistrictsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockDistrictsGet.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the DISTRICTS_QUERY_KEY and the ids ref', () => {
    const districtIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [DISTRICTS_QUERY_KEY, districtIds],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches one district per id, preserving order, and maps the results', async () => {
    const idA = '11111111-1111-1111-1111-111111111111';
    const idB = '22222222-2222-2222-2222-222222222222';
    const districtIds = ref([idA, idB]);

    // Resolve B slower than A to prove order follows the input array, not
    // resolution order.
    mockDistrictsGet.mockImplementation(({ params: { id } }) => {
      if (id === idB) {
        return new Promise((resolve) => setTimeout(() => resolve(districtOk(idB, { location: { city: 'Reno' } })), 5));
      }
      return Promise.resolve(districtOk(idA, { identifiers: { mdrNumber: 'MDR-A' } }));
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((d) => d.id)).toEqual([idA, idB]);
    // Mapping flattens identifiers (A) and location (B).
    expect(result[0].mdrNumber).toBe('MDR-A');
    expect(result[1].city).toBe('Reno');
    expect(mockDistrictsGet).toHaveBeenCalledWith({ params: { id: idA } });
    expect(mockDistrictsGet).toHaveBeenCalledWith({ params: { id: idB } });
  });

  it('throws a structured error when any district lookup is non-200', async () => {
    const districtIds = ref(['11111111-1111-1111-1111-111111111111']);
    mockDistrictsGet.mockResolvedValueOnce({ status: 404, body: { error: { code: 'resource/not-found' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { code: 'resource/not-found' } },
    });
  });

  it('is disabled when the ids array is empty', () => {
    const districtIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('becomes enabled once the ids array is populated', async () => {
    const districtIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    districtIds.value = ['11111111-1111-1111-1111-111111111111'];
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    const districtIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    const districtIds = ref(['11111111-1111-1111-1111-111111111111']);
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useDistrictsQuery(districtIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
