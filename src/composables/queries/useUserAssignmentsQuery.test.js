import { ref, nextTick, isRef, isReadonly } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { getUserAssignments } from '@/helpers/query/assignments';
import useUserAssignmentsQuery from './useUserAssignmentsQuery';
import { USER_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';

vi.mock('@/helpers/query/assignments', () => ({
  getUserAssignments: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useUserAssignmentsQuery', () => {
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
    const mockUserId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    withSetup(() => useUserAssignmentsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_ASSIGNMENTS_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(mockUserId.value);
    expect(call.queryKey[2]).toBe(null);
    expect(call.queryKey[3]).toBe(null);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(true);
    expect(call.refetchOnWindowFocus).toBe('always');

    expect(getUserAssignments).toHaveBeenCalledWith(mockUserId.value, null, null, false);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserAssignmentsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_ASSIGNMENTS_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(mockUserId.value);
    expect(call.queryKey[2]).toBe(null);
    expect(call.queryKey[3]).toBe(null);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(false);

    expect(getUserAssignments).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(getUserAssignments).toHaveBeenCalledWith(mockUserId.value, null, null, false);
  });

  it('should only fetch data once the uid is available', async () => {
    const mockUserId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;

    withSetup(() => useUserAssignmentsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_ASSIGNMENTS_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(null);
    expect(call.queryKey[2]).toBe(null);
    expect(call.queryKey[3]).toBe(null);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    expect(call.enabled.value).toBe(false);

    expect(getUserAssignments).not.toHaveBeenCalled();

    const newId = nanoid();
    mockUserId.value = newId;
    await nextTick();

    expect(getUserAssignments).toHaveBeenCalledWith(newId, null, null, false);
  });

  it('should not let queryOptions override the internally computed value', () => {
    const mockUserId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;

    const queryOptions = {
      enabled: true,
    };

    withSetup(() => useUserAssignmentsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    const call = vi.mocked(VueQuery.useQuery).mock.calls[0][0];
    expect(call.queryKey[0]).toBe(USER_ASSIGNMENTS_QUERY_KEY);
    expect(call.queryKey[1].value).toBe(null);
    expect(call.queryKey[2]).toBe(null);
    expect(call.queryKey[3]).toBe(null);
    expect(call.queryFn).toBeInstanceOf(Function);
    expect(isRef(call.enabled)).toBe(true);
    expect(isReadonly(call.enabled)).toBe(true);
    // Even though queryOptions.enabled is true, the internal computed value should be false
    // because uid is null
    expect(call.enabled.value).toBe(false);

    expect(getUserAssignments).not.toHaveBeenCalled();
  });
});
