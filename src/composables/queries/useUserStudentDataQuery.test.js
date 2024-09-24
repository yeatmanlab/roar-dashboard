import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserStudentDataQuery from './useUserStudentDataQuery';

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

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student', mockUserRoarId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('users', mockUserRoarId, ['studentData']);
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserRoarId = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserStudentDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student', mockUserRoarId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('users', mockUserRoarId, ['studentData']);
  });

  it('should only fetch data once the roarUid is available', async () => {
    const mockUserRoarId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    const queryOptions = { enabled: true };

    withSetup(() => useUserStudentDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student', mockUserRoarId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    mockUserRoarId.value = nanoid();
    await nextTick();

    expect(VueQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['user-student', mockUserRoarId],
      }),
    );

    expect(fetchDocById).toHaveBeenCalledWith('users', mockUserRoarId, ['studentData']);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockUserRoarId = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarId;

    const queryOptions = { enabled: true };

    withSetup(() => useUserStudentDataQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user-student', mockUserRoarId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();
  });
});
