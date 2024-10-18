import { ref, watch } from 'vue';
import _once from 'lodash/once';
import _cloneDeep from 'lodash/cloneDeep';

let initialTableData = null;
const setInitialTableData = _once((data) => {
  initialTableData = data;
});

/**
 * A composable function that manages filtered table data based on provided school and grade filters.
 *
 * @param {Ref<Array>} tableData - A reactive reference to the table data that will be filtered.
 * @returns {Object} - An object containing the filtered table data and a function to update the filters.
 * @property {Ref<Array>} filteredTableData - A reactive reference to the filtered table data.
 * @property {Function} updateFilters - A function to update the filters applied to the table data.
 *
 * The `updateFilters` function expects two arrays as arguments:
 * - `filterSchools`: An array of school names to filter the data by. Default is an empty array.
 * - `filterGrades`: An array of grades to filter the data by. Default is an empty array.
 *
 * The function creates a deep clone of the initial table data to avoid mutating the original data.
 * It then filters the data based on the provided school names and grades.
 * If no filters are applied, it resets the table data to the initial state.
 *
 * The `watch` function observes changes to the `tableData` and updates the `filteredTableData` accordingly.
 * It also snapshots the data once before any filters are applied if the table data is not empty.
 */
export function useFilteredTableData(tableData) {
  const filteredTableData = ref(tableData);

  const updateFilters = (filterSchools = [], filterGrades = []) => {
    const filteredData = ref(_cloneDeep(initialTableData) ?? []);

    if (filterSchools.length) {
      filteredData.value = filteredData.value.filter((item) => filterSchools.includes(item?.user.schoolName));
    }
    if (filterGrades.length) {
      filteredData.value = filteredData.value.filter((item) => filterGrades.includes(String(item?.user.grade)));
    }

    filteredTableData.value = !filterSchools.length && !filterGrades.length ? initialTableData : filteredData.value;
  };

  watch(tableData, (newValue) => {
    if (!initialTableData && newValue?.length) {
      setInitialTableData(newValue);
    }
    filteredTableData.value = newValue;
  });

  return { filteredTableData, updateFilters };
}
