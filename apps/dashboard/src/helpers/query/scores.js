import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

/**
 * Get aggregated support categories for an administration via the ts-rest backend API.
 *
 * Prefer using useAdministrationSupportCategoriesQuery composable over calling this directly.
 *
 * @param {String} administrationId - The administration UUID
 * @param {String} districtId - The district UUID
 * @returns {Promise<AggregatedSupportCategories>} Aggregated support categories by task
 *
 * @example
 * ```javascript
 * // Recommended: Use the query composable
 * const { data } = useAdministrationSupportCategoriesQuery(administrationId, districtId);
 *
 * // Or use this helper directly for simple async/await
 * const aggregated = await getAdministrationSupportCategories(adminId, districtId);
 * console.log(aggregated.swr.achievedSkill.total); // Number of students achieving skill level
 * ```
 */
export const getAdministrationSupportCategories = async (administrationId, districtId) => {
  const authStore = useAuthStore();
  const { accessToken } = storeToRefs(authStore);

  if (!accessToken.value) {
    throw new Error('User is not authenticated');
  }

  const response = await fetch(`/v1/administrations/${administrationId}/support-categories?districtId=${districtId}`, {
    headers: {
      Authorization: `Bearer ${accessToken.value}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch support categories: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data;
};
