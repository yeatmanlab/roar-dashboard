import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { getDistrictSupportCategories } from '@/helpers/query/scores';
import useDistrictSupportCategoriesQuery from './useDistrictSupportCategoriesQuery';

vi.mock('@/helpers/query/utils', () => ({
  fetchDocumentsById: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

vi.mock('@/helpers/query/scores', () => ({
  getDistrictSupportCategories: vi.fn().mockImplementation(() => {}),
}));

describe('useDistrictSupportCategoriesQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const districtId = nanoid();
    const assignmentId = nanoid();

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSupportCategoriesQuery(districtId, assignmentId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['district-support-categories', districtId, assignmentId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(getDistrictSupportCategories).toHaveBeenCalledWith(districtId, assignmentId);
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const districtId = nanoid();
    const assignmentId = nanoid();
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSupportCategoriesQuery(districtId, assignmentId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['district-support-categories', districtId, assignmentId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(getDistrictSupportCategories).not.toHaveBeenCalled();
  });

  it('should not fetch data if district or assignment ID is not available', async () => {
    const districtId = ref(nanoid());
    const assignmentId = ref(null);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSupportCategoriesQuery(districtId, assignmentId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['district-support-categories', districtId, assignmentId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(getDistrictSupportCategories).not.toHaveBeenCalled();

    assignmentId.value = nanoid();
    await nextTick();

    expect(getDistrictSupportCategories).toHaveBeenCalledWith(districtId, assignmentId);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const districtId = null;
    const assignmentId = null;
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useDistrictSupportCategoriesQuery(districtId, assignmentId, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['district-support-categories', districtId, assignmentId],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(getDistrictSupportCategories).not.toHaveBeenCalled();
  });
});
