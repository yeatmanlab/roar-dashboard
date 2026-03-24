import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

export const getDistrictSupportCategories = async (districtId, assignmentId) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  const aggregatedScores = await roarfirekit.value.aggregateSupportCategories(districtId, assignmentId);

  return aggregatedScores;
};
