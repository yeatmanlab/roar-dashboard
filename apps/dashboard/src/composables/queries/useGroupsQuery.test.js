import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { GROUPS_QUERY_KEY } from '@/constants/queryKeys';
import useGroupsQuery from './useGroupsQuery';

const mockGroupsGet = vi.fn();
const mockUseAuthStore = vi.fn(() => ({ accessToken: 'test-token' }));

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    groups: { get: mockGroupsGet },
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

const groupOk = (id, extra = {}) => ({
  status: 200,
  body: { data: { id, name: `Group ${id}`, ...extra } },
});

describe('useGroupsQuery', () => {
  let queryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new VueQuery.QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockGroupsGet.mockReset();
    mockUseAuthStore.mockReset();
    mockUseAuthStore.mockReturnValue({ accessToken: 'test-token' });
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('calls useQuery with the GROUPS_QUERY_KEY and the ids ref', () => {
    const groupIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [GROUPS_QUERY_KEY, groupIds],
        queryFn: expect.any(Function),
      }),
    );
  });

  it('fetches one group per id, preserving order, and maps the results', async () => {
    const idA = '11111111-1111-1111-1111-111111111111';
    const idB = '22222222-2222-2222-2222-222222222222';
    const groupIds = ref([idA, idB]);

    // Resolve B slower than A to prove order follows the input array, not
    // resolution order.
    mockGroupsGet.mockImplementation(({ params: { groupId } }) => {
      if (groupId === idB) {
        return new Promise((resolve) => setTimeout(() => resolve(groupOk(idB, { location: { city: 'Reno' } })), 5));
      }
      return Promise.resolve(groupOk(idA, { abbreviation: 'GA' }));
    });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const result = await queryFn();
    expect(result.map((g) => g.id)).toEqual([idA, idB]);
    // Mapping preserves scalar fields (A) and flattens location (B).
    expect(result[0].abbreviation).toBe('GA');
    expect(result[1].city).toBe('Reno');
    expect(mockGroupsGet).toHaveBeenCalledWith({ params: { groupId: idA } });
    expect(mockGroupsGet).toHaveBeenCalledWith({ params: { groupId: idB } });
  });

  it('throws a structured error when any group lookup is non-200', async () => {
    const groupIds = ref(['11111111-1111-1111-1111-111111111111']);
    mockGroupsGet.mockResolvedValueOnce({ status: 404, body: { error: { code: 'resource/not-found' } } });

    let queryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      queryFn = options.queryFn;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    await expect(queryFn()).rejects.toMatchObject({
      status: 404,
      body: { error: { code: 'resource/not-found' } },
    });
  });

  it('is disabled when the ids array is empty', () => {
    const groupIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('becomes enabled once the ids array is populated', async () => {
    const groupIds = ref([]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef.value).toBe(false);

    groupIds.value = ['11111111-1111-1111-1111-111111111111'];
    await nextTick();

    expect(enabledRef.value).toBe(true);
  });

  it('is disabled when the auth store has no access token', () => {
    mockUseAuthStore.mockReturnValue({ accessToken: null });
    const groupIds = ref(['11111111-1111-1111-1111-111111111111']);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery.mock.calls[0][0].enabled.value).toBe(false);
  });

  it('does not retry on terminal auth or rostering-ended errors but retries transient ones', () => {
    const groupIds = ref(['11111111-1111-1111-1111-111111111111']);
    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useGroupsQuery(groupIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(retryFn(0, { body: { error: { code: 'auth/required' } } })).toBe(false);
    expect(retryFn(0, { body: { error: { code: 'auth/rostering-ended' } } })).toBe(false);
    expect(retryFn(0, new Error('network down'))).toBe(true);
    expect(retryFn(3, new Error('network down'))).toBe(false);
  });
});
