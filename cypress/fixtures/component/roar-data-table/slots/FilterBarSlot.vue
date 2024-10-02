<template>
  <div class="flex flex-row flex-wrap gap-2 align-items-center justify-content-center">
    <div v-if="schoolsInfo" class="flex flex-row my-3">
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-school-filter"
          v-model="filterSchools"
          style="width: 10rem; max-width: 15rem"
          :options="schoolsInfo"
          option-label="name"
          option-value="name"
          :show-toggle-all="false"
          selected-items-label="{0} schools selected"
          data-cy="filter-by-school"
        />
        <label for="ms-school-filter">Filter by School</label>
      </span>
    </div>
    <div class="flex flex-row gap-2 my-3">
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-grade-filter"
          v-model="filterGrades"
          style="width: 10rem; max-width: 15rem"
          :options="gradeOptions"
          option-label="label"
          option-value="value"
          :show-toggle-all="false"
          selected-items-label="{0} grades selected"
          data-cy="filter-by-grade"
        />
        <label for="ms-school-filter">Filter by Grade</label>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { gradeOptions } from '../../../../../src/helpers/reports.js';
import dataTemplate from '../dataTemplate.js';
import schoolsInfo from '../schools';

const filteredTableData = ref([]);
const filterSchools = ref([]);
const filterGrades = ref([]);

const computeAssignmentAndRunData = ref({ assignmentTableData: dataTemplate });

const resetFilters = () => {
  isUpdating.value = true;

  filterSchools.value = [];
  filterGrades.value = [];
  isUpdating.value = false;
};

const isUpdating = ref(false);

watch([filterSchools, filterGrades], ([newSchools, newGrades]) => {
  // If an update is already in progress, return early to prevent recursion
  if (isUpdating.value) {
    return;
  }
  if (newSchools.length > 0 || newGrades.length > 0) {
    isUpdating.value = true;
    //set scoresTableData to filtered data if filter is added
    let filteredData = computeAssignmentAndRunData.value.assignmentTableData;

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

    isUpdating.value = false; // Reset the flag after the update
  } else {
    filteredTableData.value = computeAssignmentAndRunData.value.assignmentTableData;
  }
});
</script>
