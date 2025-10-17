import { ref, nextTick } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchDocsById } from '@/helpers/query/utils';
import useAdministrationsStatsQuery from './useAdministrationsStatsQuery';

vi.mock('@/helpers/query/utils', () => ({
  fetchDocsById: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

const buildCollectionRequestPayload = (id) => {
  return {
    collection: 'administrations',
    docId: `${id}/stats/total`,
  };
};

const buildCollectionRequestPayloadWithOrgId = (id, orgId) => {
  return {
    collection: 'administrations',
    docId: `${id}/stats/${orgId}`,
  };
};

describe('useAdministrationsStatsQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters when no orgId is passed in', async () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    let capturedQueryFn;

    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      capturedQueryFn = options.queryFn;
      return {
        data: ref(null),
        isLoading: ref(false),
        error: ref(null),
      };
    });

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    expect(VueQuery.useQuery).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        queryKey: ['administrations-stats', mockAdministrationIds],
        queryFn: expect.any(Function),
        enabled: expect.any(Object),
      }),
    );

    // Execute the captured query function
    await capturedQueryFn();

    const expectedPayload1 = mockAdministrationIds.value.map((id) => buildCollectionRequestPayload(id));
    expect(fetchDocsById).toHaveBeenCalledTimes(1);
    expect(fetchDocsById).toHaveBeenCalledExactlyOnceWith(expectedPayload1);
  });
  it('should call query with correct parameters when an orgId is passed in', async () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    let capturedQueryFn;

    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      capturedQueryFn = options.queryFn;
      return {
        data: ref(null),
        isLoading: ref(false),
        error: ref(null),
      };
    });

    const orgId = ref('123456');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, orgId), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    expect(VueQuery.useQuery).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        queryKey: ['administrations-stats', mockAdministrationIds],
        queryFn: expect.any(Function),
        enabled: expect.any(Object),
      }),
    );

    // Execute the captured query function
    await capturedQueryFn();

    const expectedPayload2 = mockAdministrationIds.value.map((id) =>
      buildCollectionRequestPayloadWithOrgId(id, orgId.value),
    );

    expect(fetchDocsById).toHaveBeenCalledTimes(1);
    expect(fetchDocsById).toHaveBeenCalledExactlyOnceWith(expectedPayload2);
  });

  it('should allow the query to be disabled via the passed query options', async () => {
    const mockAdministrationIds = ref([nanoid(), nanoid(), nanoid()]);
    const queryOptions = { enabled: false };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    expect(VueQuery.useQuery).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        queryKey: ['administrations-stats', mockAdministrationIds],
        queryFn: expect.any(Function),
        enabled: expect.any(Object),
      }),
    );

    expect(fetchDocsById).not.toHaveBeenCalled();
  });

  it('should only fetch data if the administration IDs are available', async () => {
    const mockAdministrationIds = ref([nanoid(), nanoid()]);
    let capturedQueryFn;

    vi.spyOn(VueQuery, 'useQuery').mockImplementation((options) => {
      capturedQueryFn = options.queryFn;
      return {
        data: ref(null),
        isLoading: ref(false),
        error: ref(null),
      };
    });

    const queryOptions = { enabled: true };

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    expect(VueQuery.useQuery).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        queryKey: ['administrations-stats', mockAdministrationIds],
        queryFn: expect.any(Function),
        enabled: expect.any(Object),
      }),
    );

    // Execute the captured query function
    await capturedQueryFn();

    expect(fetchDocsById).toHaveBeenCalledTimes(1);
    expect(fetchDocsById).toHaveBeenLastCalledWith(
      mockAdministrationIds.value.map((id) => buildCollectionRequestPayload(id)),
    );

    mockAdministrationIds.value = [nanoid(), nanoid()];
    await nextTick();
    await capturedQueryFn();

    expect(fetchDocsById).toHaveBeenCalledTimes(2);
    expect(fetchDocsById).toHaveBeenLastCalledWith(
      mockAdministrationIds.value.map((id) => buildCollectionRequestPayload(id)),
    );
  });

  it('should not let queryOptions override the internally computed value', async () => {
    const mockAdministrationIds = ref(null);
    const queryOptions = { enabled: true };

    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useAdministrationsStatsQuery(mockAdministrationIds, null, queryOptions), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledTimes(1);
    expect(VueQuery.useQuery).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        queryKey: ['administrations-stats', mockAdministrationIds],
        queryFn: expect.any(Function),
        enabled: expect.any(Object),
      }),
    );

    expect(fetchDocsById).not.toHaveBeenCalled();
  });
});
