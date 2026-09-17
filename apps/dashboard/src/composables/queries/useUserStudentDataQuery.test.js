import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import useUserStudentDataQuery from './useUserStudentDataQuery';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';

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

describe('useUserStudentDataQuery', () => {
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockUsersGet.mockReset();
    mockUsersGet.mockResolvedValue({
      status: StatusCodes.OK,
      body: { data: { id: 'user-uuid', grade: '3', dob: '2015-04-01' } },
    });
  });

  afterEach(() => {
    queryClient?.clear();
    vi.clearAllMocks();
  });

  it('should call query with correct parameters', () => {
    const mockUserRoarId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;
    authStore.accessToken = 'test-token';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_STUDENT_DATA_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(mockUserRoarId.value);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
  });

  it('fetches the user and returns it with studentData nested (the shape consumers read)', async () => {
    const uid = nanoid();
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(uid);

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const user = await queryFn();

    expect(mockUsersGet).toHaveBeenCalledWith({ params: { id: uid } });
    // Consumers (the Task players) read `studentData.dob` / `studentData.grade` off the result,
    // so studentData must stay nested rather than being returned as a bare slice.
    expect(user.studentData).toMatchObject({ grade: '3', dob: '2015-04-01' });
  });

  it('throws when the API returns a non-200 status', async () => {
    mockUsersGet.mockResolvedValue({ status: StatusCodes.NOT_FOUND, body: {} });

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(nanoid());

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    await expect(queryFn()).rejects.toThrow(/status 404/);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserRoarId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;
    authStore.accessToken = 'test-token';

    const enableQuery = ref(false);

    withSetup(() => useUserStudentDataQuery(null, { enabled: enableQuery }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.enabled.value).toBe(false);

    enableQuery.value = true;
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('should only enable the query once the roarUid is available', async () => {
    const mockUserRoarId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;
    authStore.accessToken = 'test-token';

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[1].value).toBe(null);
    expect(call.enabled.value).toBe(false);

    mockUserRoarId.value = nanoid();
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('should only enable the query once the access token is available', async () => {
    const mockUserRoarId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;
    authStore.accessToken = null;

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    // Even with a resolved uid, the query stays disabled until the access token is present.
    expect(call.enabled.value).toBe(false);

    authStore.accessToken = 'test-token';
    await nextTick();

    expect(call.enabled.value).toBe(true);
  });

  it('does not retry on terminal auth or rostering-ended errors', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(nanoid());
    authStore.accessToken = 'test-token';

    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserStudentDataQuery(), {
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
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(nanoid());
    authStore.accessToken = 'test-token';

    let retryFn;
    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      retryFn = options.retry;
      return { data: { value: null }, error: { value: null } };
    });

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const networkError = new Error('network down');
    expect(retryFn(0, networkError)).toBe(true);
    expect(retryFn(2, networkError)).toBe(true);
    expect(retryFn(3, networkError)).toBe(false);
  });

  it('should not let queryOptions override the internally computed value', () => {
    const mockUserRoarId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    withSetup(() => useUserStudentDataQuery(null, { enabled: true }), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    // Even though queryOptions.enabled is true, the internal computed value should be false
    // because roarUid is null.
    expect(call.enabled.value).toBe(false);
    expect(mockUsersGet).not.toHaveBeenCalled();
  });
});
