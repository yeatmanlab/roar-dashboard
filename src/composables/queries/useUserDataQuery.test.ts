import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import useUserDataQuery from './useUserDataQuery';

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

describe('useUserDataQuery', () => {
  let piniaInstance: ReturnType<typeof createTestingPinia>;
  let queryClient: QueryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
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

    expect(fetchDocById).toHaveBeenCalledWith('users', expect.objectContaining({ _value: authStore.roarUid }));
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

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user', expect.objectContaining({ _value: mockStudentUserId })],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocById).toHaveBeenCalledWith('users', expect.objectContaining({ _value: mockStudentUserId }));
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserRoarUid = ref(nanoid());

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useUserDataQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user', expect.objectContaining({ _value: authStore.roarUid })],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('users', expect.objectContaining({ _value: authStore.roarUid }));
  });

  it('should only fetch data once the roarUid is available', async () => {
    const mockUserRoarUid = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const queryOptions = { enabled: true };

    withSetup(() => useUserDataQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user', expect.objectContaining({ _value: authStore.roarUid })],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();

    mockUserRoarUid.value = nanoid();
    await nextTick();

    expect(fetchDocById).toHaveBeenCalledWith('users', expect.objectContaining({ _value: authStore.roarUid }));
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockUserRoarUid = ref(null);

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserRoarUid;

    const queryOptions = { enabled: true };

    withSetup(() => useUserDataQuery(null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['user', expect.objectContaining({ _value: authStore.roarUid })],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchDocById).not.toHaveBeenCalled();
  });
});
