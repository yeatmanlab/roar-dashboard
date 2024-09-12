import { computed, ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import * as VueQuery from '@tanstack/vue-query';
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
  let piniaInstance;
  let queryClient;

  beforeEach(() => {
    piniaInstance = createTestingPinia();
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call useQuery with correct parameters', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roarUid-1';

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useSurveyResponsesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['survey-responses'],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
        __v_isRef: true,
        __v_isReadonly: true,
      }),
    });
  });

  it('should call fetchSubcollection with correct parameters', () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roarUid-1';

    withSetup(() => useSurveyResponsesQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(fetchSubcollection).toHaveBeenCalledWith('users/mock-roarUid-1', 'surveyResponses');
  });

  it('should correctly control the enabled state of the query', async () => {
    const authStore = useAuthStore(piniaInstance);
    authStore.roarUid = 'mock-roarUid-1';

    const enableQuery = ref(false);

    const queryOptions = {
      enabled: computed(() => enableQuery.value),
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
        __v_isReadonly: true,
      }),
    });

    expect(fetchSubcollection).not.toHaveBeenCalled();

    enableQuery.value = true;
    await nextTick();

    expect(fetchSubcollection).toHaveBeenCalled();
  });
});
