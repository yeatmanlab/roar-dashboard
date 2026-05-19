import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { AGREEMENT_VERSION_CONTENT_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Agreement version content query.
 *
 * Fetches the raw markdown content for a specific agreement version from
 * `GET /agreements/:agreementId/versions/:versionId/content`. Used by the
 * SignTos flow to render the agreement body in the `ConsentModal`.
 *
 * Per the contract, content is immutable per version (tied to a specific
 * GitHub commit SHA), so it is highly cacheable — TanStack Query's default
 * 10-minute stale time is more than sufficient.
 *
 * @param {import('vue').MaybeRefOrGetter<string|null|undefined>} agreementId – The agreement ID, reactive.
 * @param {import('vue').MaybeRefOrGetter<string|null|undefined>} versionId – The version ID, reactive.
 * @param {QueryOptions|undefined} [queryOptions] – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAgreementVersionContentQuery = (agreementId, versionId, queryOptions = undefined) => {
  const conditions = [() => Boolean(toValue(agreementId)), () => Boolean(toValue(versionId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [AGREEMENT_VERSION_CONTENT_QUERY_KEY, agreementId, versionId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.agreements.getVersionContent({
        params: {
          agreementId: toValue(agreementId),
          versionId: toValue(versionId),
        },
      });

      if (result.status === StatusCodes.OK) {
        return result.body.data;
      }

      const error = new Error(`Agreement version content request failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    // Caller options first, then the access guards last so a caller-supplied
    // `enabled` can't silently override the agreement/version readiness check.
    ...options,
    enabled: isQueryEnabled,
  });
};

export default useAgreementVersionContentQuery;
