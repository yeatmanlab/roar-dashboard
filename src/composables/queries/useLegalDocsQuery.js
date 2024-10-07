import { useQuery } from '@tanstack/vue-query';
import { fetchLegalDocs } from '@/helpers/query/legal';
import { LEGAL_DOCS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Legal docs query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useLegalDocsQuery = (queryOptions = undefined) => {
  return useQuery({
    queryKey: [LEGAL_DOCS_QUERY_KEY],
    queryFn: () => fetchLegalDocs(),
    ...queryOptions,
  });
};

export default useLegalDocsQuery;
