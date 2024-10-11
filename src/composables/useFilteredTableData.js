import { ref, watch } from 'vue';
import _once from 'lodash/once';

export function useFilteredTableData(tableData) {
  // Snapshot the data once before any filters are applied
  let data = null;
  const setData = _once(() => {
    data = tableData.value;
  });

  // Create a reactive reference to the table data
  const filteredTableData = ref(tableData);

  // Expects an unwrapped array for each filter
  const updateFilters = (filterSchools, filterGrades) => {
    let filteredData = tableData.value;

    if (filterSchools.length > 0) {
      filteredData = filteredData.filter((item) => filterSchools.includes(item.user.schoolName));
    }
    if (filterGrades.length > 0) {
      filteredData = filteredData.filter((item) => filterGrades.includes(item.user.grade));
    }

    // Update the filteredTableData with the filtered data, or the original data if no filters are applied
    filteredTableData.value = filterSchools.length === 0 && filterGrades.length === 0 ? data : filteredData;
  };

  // Watch for changes to the table data and update the filteredTableData
  // setData() is called only once to snapshot the data before any filters are applied
  watch(tableData, (newValue) => {
    setData();

    filteredTableData.value = newValue;
  });

  return { filteredTableData, updateFilters };
}
