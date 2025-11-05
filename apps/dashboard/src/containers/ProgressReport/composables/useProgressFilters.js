import { ref, watch } from 'vue';

/**
 * Progress Report Filters Composable
 *
 * Manages filtering logic for schools and grades in the progress report table.
 *
 * @param {import('vue').ComputedRef} progressData - The computed progress data to filter
 * @returns {Object} Filter state and methods
 */
export function useProgressFilters(progressData) {
  const filterSchools = ref([]);
  const filterGrades = ref([]);
  const filteredTableData = ref(progressData.value);

  // Update filteredTableData when progressData changes
  watch(progressData, (newValue) => {
    filteredTableData.value = newValue;
  });

  // Apply filters when filter values change
  watch([filterSchools, filterGrades], ([newSchools, newGrades]) => {
    if (newSchools.length > 0 || newGrades.length > 0) {
      let filteredData = progressData.value;

      if (newSchools.length > 0) {
        filteredData = filteredData.filter((item) => {
          return newSchools.includes(item.user.schoolName);
        });
      }

      if (newGrades.length > 0) {
        filteredData = filteredData.filter((item) => {
          return newGrades.includes(item.user.grade);
        });
      }

      filteredTableData.value = filteredData;
    } else {
      filteredTableData.value = progressData.value;
    }
  });

  const resetFilters = () => {
    filterSchools.value = [];
    filterGrades.value = [];
  };

  return {
    filterSchools,
    filterGrades,
    filteredTableData,
    resetFilters,
  };
}
