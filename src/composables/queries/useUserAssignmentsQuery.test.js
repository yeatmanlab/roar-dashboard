import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { getUserAssignments } from '@/helpers/query/assignments';
import useUserAssignmentsQuery from './useUserAssignmentsQuery';

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

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserAssignmentsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-assignments', mockUserId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
      refetchOnWindowFocus: 'always',
    });

    expect(getUserAssignments).toHaveBeenCalledWith(mockUserId);
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

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-assignments', mockUserId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
      refetchOnWindowFocus: 'always',
    });

    expect(getUserAssignments).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(getUserAssignments).toHaveBeenCalledWith(mockUserId);
  });

  it('should only fetch data once the uid is available', async () => {
    const mockUserId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: true };

    withSetup(() => useUserAssignmentsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-assignments', mockUserId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
      refetchOnWindowFocus: 'always',
    });

    expect(getUserAssignments).not.toHaveBeenCalled();

    mockUserId.value = nanoid();
    await nextTick();

    expect(getUserAssignments).toHaveBeenCalledWith(mockUserId);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockUserId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: true };

    withSetup(() => useUserAssignmentsQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-assignments', mockUserId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
      refetchOnWindowFocus: 'always',
    });

    expect(getUserAssignments).not.toHaveBeenCalled();
  });
});
