import { ref, watch } from 'vue';
import _once from 'lodash/once';
import _cloneDeep from 'lodash/cloneDeep';

// Logic for capturing the initial table data being passed in
// This is to prevent mutating the original data when filtering
let initialTableData = null;
const dataTablePopulated = (data) => {
  return !initialTableData && data.length > 0;
};
const setInitialTableData = _once((data) => {
  initialTableData = data;
});

/**
 * A composable function that manages filtered table data based on provided school and grade filters.
 *
 * @param {Ref<Array>} tableData - A reactive reference to the table data that will be filtered.
 * @returns {Object} - An object containing the filtered table data and a function to update the filters.
 *
 * @property {Ref<Array>} filteredTableData - A reactive reference to the filtered table data.
 * @property {Function} updateFilters - A function to update the filters applied to the table data.
 * @param {Array} [filterSchools=[]] - An array of school names to filter the table data by. Defaults to an empty array.
 * @param {Array} [filterGrades=[]] - An array of grades to filter the table data by. Defaults to an empty array.
 */
export function useFilteredTableData(tableData) {
  // Create a reactive reference to the table data that will be filtered
  const filteredTableData = ref(tableData);

  // Expects an unwrapped array for each filter
  const updateFilters = (filterSchools = [], filterGrades = []) => {
    // Create a deep clone of the initial table data to avoid mutating the original data
    const filteredData = ref(_cloneDeep(initialTableData) ?? []);

    if (filterSchools.length > 0) {
      filteredData.value = filteredData.value.filter((item) => filterSchools.includes(item?.user.schoolName));
    }
    if (filterGrades.length > 0) {
      filteredData.value = filteredData.value.filter((item) => filterGrades.includes(String(item?.user.grade)));
    }

    // Update the filteredTableData with the filtered data, or the original data if no filters are applied
    tableData.value = filterSchools.length === 0 && filterGrades.length === 0 ? initialTableData : filteredData.value;
  };

  watch(tableData, (newValue) => {
    // Snapshot the data once before any filters are applied and ony if the tableData is not empty
    if (dataTablePopulated(tableData.value)) {
      setInitialTableData(tableData.value);
    }
    filteredTableData.value = newValue;
  });
  return { filteredTableData, updateFilters };
}
