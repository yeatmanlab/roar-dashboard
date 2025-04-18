import { useQuery } from '@tanstack/vue-query';
import type { UseQueryReturnType, QueryOptions } from '@tanstack/vue-query';
import { fetchLegalDocs } from '@/helpers/query/legal'; // Assuming fetchLegalDocs returns Promise<ConsentDocument[]>
import { LEGAL_DOCS_QUERY_KEY } from '@/constants/queryKeys';

// Define the structure of the ConsentDocument based on its usage in ConsentPicker.vue
interface ConsentDocument {
  id: string;
  fileName: string;
  currentCommit?: string;
  gitHubOrg?: string;
  gitHubRepository?: string;
  lastUpdated?: any; // Consider refining 'any' if possible
  project?: 'roar' | 'levante' | 'default';
  text?: string;
  tags?: string[];
  type: 'consent' | 'assent';
}

/**
 * Legal docs query.
 *
 * Fetches legal documents (consent/assent forms).
 * @param queryOptions - Optional TanStack query options.
 * @returns The TanStack query result for legal documents.
 */
function useLegalDocsQuery(
  queryOptions?: Omit<QueryOptions<ConsentDocument[], Error>, 'queryKey' | 'queryFn'>
): UseQueryReturnType<ConsentDocument[], Error> {
  return useQuery<ConsentDocument[], Error>({
    queryKey: [LEGAL_DOCS_QUERY_KEY],
    queryFn: () => fetchLegalDocs(), // Assuming fetchLegalDocs is correctly typed or handled elsewhere
    ...queryOptions,
  });
}

export default useLegalDocsQuery;
export type { ConsentDocument }; // Exporting the interface for potential reuse 