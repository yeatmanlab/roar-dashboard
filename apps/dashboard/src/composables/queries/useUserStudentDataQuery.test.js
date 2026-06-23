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

  it('fetches the user and returns only the mapped studentData slice', async () => {
    const uid = nanoid();
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = ref(uid);

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const { queryFn } = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    const studentData = await queryFn();

    expect(mockUsersGet).toHaveBeenCalledWith({ params: { id: uid } });
    expect(studentData).toMatchObject({ grade: '3', dob: '2015-04-01' });
    // It returns the studentData slice, not the full user object.
    expect(studentData).not.toHaveProperty('name');
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
