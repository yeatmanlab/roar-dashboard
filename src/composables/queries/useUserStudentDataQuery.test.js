import { ref, nextTick, computed } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { storeToRefs } from 'pinia';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserStudentDataQuery from './useUserStudentDataQuery';
import _ from 'lodash';

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

  it('should call useQuery with correct parameters', async () => {
    const mockFirstUserId = nanoid();
    const mockSecondUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockFirstUserId;

    expect(authStore.roarUid).toBe(mockFirstUserId);
    const { roarUid } = storeToRefs(authStore);

    authStore.roarUid = mockSecondUserId;

    await nextTick();

    expect(roarUid.value).toBe(mockSecondUserId);
  });

  it('should call query with correct parameters', () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useUserStudentDataQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('users', mockUserId, ['studentData']);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserStudentDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('users', mockUserId, ['studentData']);
  });

  it('should only fetch data if the roarUid is available', async () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = null;

    const queryOptions = { enabled: true };

    withSetup(() => useUserStudentDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    authStore.roarUid = mockUserId;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('users', mockUserId, ['studentData']);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = null;

    const queryOptions = { enabled: true };

    withSetup(() => useUserStudentDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();
  });
});
