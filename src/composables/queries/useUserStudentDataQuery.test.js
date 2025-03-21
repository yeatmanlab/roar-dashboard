import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserStudentDataQuery from './useUserStudentDataQuery';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: vi.fn().mockImplementation(() => []),
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
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
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

    expect(fetchDocById).toHaveBeenCalledWith(FIRESTORE_COLLECTIONS.USERS, mockUserRoarId.value, ['studentData']);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserRoarId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserStudentDataQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_STUDENT_DATA_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(mockUserRoarId.value);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(false);

    expect(fetchDocById).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith(FIRESTORE_COLLECTIONS.USERS, mockUserRoarId.value, ['studentData']);
  });

  it('should only fetch data once the roarUid is available', async () => {
    const mockUserRoarId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_STUDENT_DATA_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(null);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(false);

    expect(fetchDocById).not.toHaveBeenCalled();

    const newId = nanoid();
    mockUserRoarId.value = newId;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith(FIRESTORE_COLLECTIONS.USERS, newId, ['studentData']);
  });

  it('should not let queryOptions override the internally computed value', () => {
    const mockUserRoarId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    const queryOptions = {
      enabled: true,
    };

    withSetup(() => useUserStudentDataQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_STUDENT_DATA_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(null);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    // Even though queryOptions.enabled is true, the internal computed value should be false
    // because roarUid is null
    expect(call.enabled.value).toBe(false);

    expect(fetchDocById).not.toHaveBeenCalled();
  });
});
