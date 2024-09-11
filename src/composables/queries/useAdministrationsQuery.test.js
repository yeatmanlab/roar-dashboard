import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { nanoid } from 'nanoid';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchDocsById } from '@/helpers/query/utils';
import useAdministrationsQuery from './useAdministrationsQuery';

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
    docId: id,
    select: ['name', 'publicName', 'sequential', 'assessments', 'legal'],
  };
};

describe('useAdministrationsQuery', () => {
  let queryClient;

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
    });

    const expectedPayload = mockAdministrationIds.value.map((id) => buildCollectionRequestPayload(id));

    expect(fetchDocsById).toHaveBeenCalledWith(expectedPayload);
  });
});
