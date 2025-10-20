import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

export const getDistrictSupportCategories = async (districtId, assignmentId) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  console.log('districtId from scores.js', districtId);
  console.log('assignmentId from scores.js', assignmentId);
  const aggregatedScores = await roarfirekit.value.aggregateSupportCategories(districtId, assignmentId);
  console.log('aggregatedScores from scores.js', aggregatedScores.data);

  // {
  //   swr: {
  //     "Category 1": {
  //       schools: { "schoolId1": 3, "schoolId2": 5 },
  //       grades: { "K": 2, "1": 4, "2": 1 },
  //       total: 0
  //     },
  //     "Category 2": {
  //       schools: { "schoolId3": 2, "schoolId4": 1 },
  //       grades: { "3": 3, "4": 2 },
  //       total: 0
  //     },
  //     "Category 3": {
  //       schools: { "schoolId5": 1, "schoolId6": 2 },
  //       grades: { "5": 1, "6": 1 },
  //       total: 0
  //     },
  //     raw: {
  //       "0-99": {
  //         schools: { "schoolId1": 2, "schoolId2": 1 },
  //         grades: { "K": 1, "1": 2 },
  //       },
  //       "100-199": {
  //         schools: { "schoolId1": 3, "schoolId3": 1 },
  //         grades: { "2": 2, "3": 2 }
  //       },
  //       "200-299": {
  //         schools: { "schoolId2": 1 },
  //         grades: { "4": 1 }
  //       }
  //     },
  //     percentile: {
  //       "0-9": {
  //         schools: { "schoolId1": 1 },
  //         grades: { "K": 1 }
  //       },
  //       "10-19": {
  //         schools: { "schoolId2": 2 },
  //         grades: { "1": 2 }
  //       }
  //     }
  //   },

  return aggregatedScores;
};
