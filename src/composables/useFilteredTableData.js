import { ref, watch } from 'vue';

export function useFilteredTableData(computeAssignmentAndRunData) {
  // Flag to track whether the watcher is already processing an update
  const isUpdating = ref(false);

  const filteredTableData = ref(computeAssignmentAndRunData.value.assignmentTableData);

  // Expects an unwrapped array ref for each filter
  const updateFilters = (filterSchools, filterGrades) => {
    if (isUpdating.value) return;

    isUpdating.value = true;
    let filteredData = computeAssignmentAndRunData.value.assignmentTableData;

    if (filterSchools.length > 0) {
      filteredData = filteredData.filter((item) => filterSchools.includes(item.user.schoolName));
    }
    if (filterGrades.length > 0) {
      filteredData = filteredData.filter((item) => filterGrades.includes(item.user.grade));
    }

    // Update the filteredTableData with the filtered data, or the original data if no filters are applied
    filteredTableData.value =
      filterSchools.length === 0 && filterGrades.length === 0
        ? computeAssignmentAndRunData.value.assignmentTableData
        : filteredData;

    isUpdating.value = false;
  };

  watch(computeAssignmentAndRunData, (newValue) => {
    // Update filteredTableData when computedProgressData changes
    filteredTableData.value = newValue.assignmentTableData;
  });

  return { filteredTableData, updateFilters };
}
