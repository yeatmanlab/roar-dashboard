import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { type QueryClient } from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchDocumentsById } from '@/helpers/query/utils';
import useAdministrationsQuery from './useAdministrationsQuery';

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

describe('useAdministrationsQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsQuery(mockAdministrationIds), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations', mockAdministrationIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: true,
      }),
    });

    expect(fetchDocumentsById).toHaveBeenCalledWith('administrations', mockAdministrationIds);
  });

  it('should allow the query to be disabled via the passed query options', () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsQuery(mockAdministrationIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations', mockAdministrationIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();
  });

  it('should only fetch data if the administration IDs are available', async () => {
    const mockAdministrationIds = ref(null);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsQuery(mockAdministrationIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations', mockAdministrationIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();

    mockAdministrationIds.value = [nanoid(), nanoid()];
    await nextTick();

    expect(fetchDocumentsById).toHaveBeenCalledWith('administrations', mockAdministrationIds);
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockAdministrationIds = ref(null);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsQuery(mockAdministrationIds, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['administrations', mockAdministrationIds],
      queryFn: expect.any(Function),
      enabled: expect.objectContaining({
        _value: false,
      }),
    });

    expect(fetchDocumentsById).not.toHaveBeenCalled();
  });
});
