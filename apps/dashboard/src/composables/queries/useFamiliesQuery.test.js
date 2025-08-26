import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchDocumentsById } from '@/helpers/query/utils';
import useFamiliesQuery from './useFamiliesQuery';

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

describe('useFamiliesQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const mockFamilyIds = ref([nanoid()]);

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(mockFamilyIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['families', mockFamilyIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocumentsById).toHaveBeenCalledWith('families', mockFamilyIds);
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const mockFamilyIds = ref([nanoid()]);
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(mockFamilyIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['families', mockFamilyIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();
  });

  it('should keep the query disabled if not family IDs are specified', () => {
    const mockFamilyIds = ref([]);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(mockFamilyIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['families', mockFamilyIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();
  });

  it('should only fetch data if the administration ID is available', async () => {
    const mockFamilyIds = ref([]);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(mockFamilyIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['families', mockFamilyIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();

    mockFamilyIds.value = [nanoid()];
    await nextTick();

    expect(fetchDocumentsById).toHaveBeenCalledWith('families', mockFamilyIds);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockFamilyIds = ref([]);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useFamiliesQuery(mockFamilyIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['families', mockFamilyIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();
  });
});
