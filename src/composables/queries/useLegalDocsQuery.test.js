import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as VueQuery from '@tanstack/vue-query';
import { withSetup } from '@/test-support/withSetup.js';
import { fetchLegalDocs } from '@/helpers/query/legal';
import useLegalDocsQuery from './useLegalDocsQuery';

vi.mock('@/helpers/query/legal', () => ({
  fetchLegalDocs: vi.fn().mockImplementation(() => []),
}));

vi.mock('@tanstack/vue-query', async (getModule) => {
  const original = await getModule();
  return {
    ...original,
    useQuery: vi.fn().mockImplementation(original.useQuery),
  };
});

describe('useLegalDocsQuery', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new VueQuery.QueryClient();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  it('should call query with correct parameters', () => {
    vi.spyOn(VueQuery, 'useQuery');

    withSetup(() => useLegalDocsQuery(), {
      plugins: [[VueQuery.VueQueryPlugin, { queryClient }]],
    });

    expect(VueQuery.useQuery).toHaveBeenCalledWith({
      queryKey: ['legal-docs'],
      queryFn: expect.any(Function),
    });

    expect(fetchLegalDocs).toHaveBeenCalledWith();
  });
});
