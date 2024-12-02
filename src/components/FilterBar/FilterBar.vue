<template>
  <div class="flex flex-row flex-wrap gap-2 align-items-center justify-content-center">
    <button
      class="my-2 bg-primary p-2 border-none border-round text-white hover:bg-red-900"
      data-cy="button-reset-filters"
      @click="resetFilters"
    >
      Reset Filters
    </button>
    <div v-if="props.schools" class="flex flex-row my-3">
      <span class="p-float-label">
        <PvMultiSelect
          id="ms-school-filter"
          v-model="filterSchools"
          style="width: 10rem; max-width: 15rem"
          :options="props.schools"
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
          :options="props.grades"
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
import PvMultiSelect from 'primevue/multiselect';

const props = defineProps({
  updateFilters: {
    type: Function,
    required: true,
  },
  schools: {
    type: Array,
    default: () => [],
  },
  grades: {
    type: Array,
    default: () => [],
  },
});

const filterSchools = ref([]);
const filterGrades = ref([]);

const resetFilters = () => {
  filterSchools.value = [];
  filterGrades.value = [];
};

watch([filterSchools, filterGrades], () => {
  props.updateFilters(filterSchools.value, filterGrades.value);
});
</script>
