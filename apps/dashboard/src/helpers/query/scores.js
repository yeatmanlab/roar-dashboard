import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';

/**
 * Get aggregated support categories for an administration via the ts-rest backend API.
 *
 * Prefer using useDistrictSupportCategoriesQuery composable over calling this directly.
 *
 * @param {String} administrationId - The administration UUID
 * @param {String} districtId - The district UUID
 * @returns {Promise<AggregatedSupportCategories>} Aggregated support categories by task
 *
 * @example
 * ```javascript
 * // Recommended: Use the query composable
 * const { data } = useDistrictSupportCategoriesQuery(districtId, administrationId);
 *
 * // Or use this helper directly for simple async/await
 * const aggregated = await getAdministrationSupportCategories(adminId, districtId);
 * console.log(aggregated.swr.achievedSkill.total); // Number of students achieving skill level
 * ```
 */
export const getAdministrationSupportCategories = async (administrationId, districtId) => {
  const client = getRoarApiClient();

  const result = await client.administrations.aggregateSupportCategories({
    params: { id: administrationId },
    query: { districtId },
  });

  if (result.status !== StatusCodes.OK) {
    const error = new Error(`Failed to fetch support categories with status ${result.status}`);
    error.status = result.status;
    error.body = result.body;
    throw error;
  }

  return result.body.data;
};
