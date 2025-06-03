import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { useAuthStore } from '@/store/auth';
import { fetchSubcollection } from '@/helpers/query/utils';
import useSurveyResponsesQuery from './useSurveyResponsesQuery';

vi.mock('@/helpers/query/utils', () => ({
  fetchSubcollection: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useSurveyResponsesQuery', () => {
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
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useSurveyResponsesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['survey-responses'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchSubcollection).toHaveBeenCalledWith(`users/${mockUserId}`, 'surveyResponses');
  });

  it('should correctly control the enabled state of the query', async () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = mockUserId;
    authStore.userQueryKeyIndex = 1;

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: enableQuery,
    };

    withSetup(() => useSurveyResponsesQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['survey-responses'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchSubcollection).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchSubcollection).toHaveBeenCalledWith(`users/${mockUserId}`, 'surveyResponses');
  });

  it('should only fetch data if the roarUid is available', async () => {
    const mockUserId = nanoid();

    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = null;
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: true };

    withSetup(() => useSurveyResponsesQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['survey-responses'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchSubcollection).not.toHaveBeenCalled();

    authStore.roarUid = mockUserId;
    await nextTick();

    expect(fetchSubcollection).toHaveBeenCalledWith(`users/${mockUserId}`, 'surveyResponses');
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = null;
    authStore.userQueryKeyIndex = 1;

    const queryOptions = { enabled: true };

    withSetup(() => useSurveyResponsesQuery(queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['survey-responses'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
        __v_isRef: true,
      }),
    });

    expect(fetchSubcollection).not.toHaveBeenCalled();
  });
});
