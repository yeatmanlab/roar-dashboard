import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useUserDataQuery from './useUserDataQuery';

const mockUsersGet = vi.fn();

vi.mock('@/clients/roar-api', () => ({
  getRoarApiClient: () => ({
    users: { get: mockUsersGet },
  }),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useUserDataQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockUsersGet.mockReset();
    mockUsersGet.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { id: 'user-uuid', nameFirst: 'Ada', nameMiddle: null, nameLast: 'Lovelace' } },
    });
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('should call query with correct parameters', () => {
    const mockUserRoarUid = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['user', expect.objectContaining({ _value: authStore.roarUid })],
        queryFn: expect.any(Function),
        enabled: expect.objectContaining({
          _value: true,
        }),
      }),
    );
  });

  it('should allow the use of a manual user ID', async () => {
    const mockUserRoarUid = ref(nanoid());
    const mockStudentUserId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(mockStudentUserId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['user', expect.objectContaining({ _value: mockStudentUserId })],
        queryFn: expect.any(Function),
        enabled: expect.objectContaining({
          _value: true,
        }),
      }),
    );
  });

  it('fetches via GET /users/:id and maps the response into the legacy shape', async () => {
    const uid = nanoid();
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(uid);

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // Invoke the queryFn directly for deterministic assertions (no TanStack scheduling).
    const { queryFn } = VueQuery.useQuery.mock.calls[0][0];
    const data = await queryFn();

    expect(mockUsersGet).toHaveBeenCalledWith({ params: { id: uid } });
    expect(data.name).toEqual({ first: 'Ada', middle: null, last: 'Lovelace' });
  });

  it('throws when the API returns a non-200 status', async () => {
    mockUsersGet.mockResolvedValue({ status: StatusCodes.FORBIDDEN, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(nanoid());

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = VueQuery.useQuery.mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 403/);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserRoarUid = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const enableQuery = ref(false);
    const queryOptions = { enabled: enableQuery };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef._value).toBe(false);

    enableQuery.value = true;
    await nextTick();

    expect(enabledRef._value).toBe(true);
  });

  it('should only enable the query once the roarUid is available', async () => {
    const mockUserRoarUid = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(null, { enabled: true }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const enabledRef = VueQuery.useQuery.mock.calls[0][0].enabled;
    expect(enabledRef._value).toBe(false);

    mockUserRoarUid.value = nanoid();
    await nextTick();

    expect(enabledRef._value).toBe(true);
  });

  it('should not let queryOptions override the internally computed enabled value', () => {
    const mockUserRoarUid = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserDataQuery(null, { enabled: true }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    // uid is still null, so the internal condition keeps the query disabled despite enabled: true.
    expect(VueQuery.useQuery.mock.calls[0][0].enabled._value).toBe(false);
    expect(mockUsersGet).not.toHaveBeenCalled();
  });
});
