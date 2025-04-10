<template>
  <div v-if="!_isEmpty(props.students) && tableColumns.length > 0" class="flex flex-column">
    <div class="flex flex-row justify-content-between align-items-center mb-3">
      <div class="flex flex-row align-items-center gap-2">
        <span class="font-bold">Valid Records:</span>
        <span :class="{ 'text-green-500': validCount === totalCount, 'text-red-500': validCount !== totalCount }">
          {{ validCount }}/{{ totalCount }}
        </span>
      </div>
    </div>
    <PvDataTable
      ref="dataTable"
      :value="sortedStudents"
      show-gridlines
      :row-hover="true"
      :resizable-columns="true"
      paginator
      :always-show-paginator="false"
      :rows="10"
      class="datatable"
      v-model:editingRows="editingRows"
      editMode="cell"
      @cell-edit-complete="onCellEditSave"
      dataKey="id"
      :pt="{
        table: { style: 'min-width: 50rem' },
        column: {
          bodycell: ({ state }) => ({
            class: [{ '!py-0': state['d_editing'] }],
          }),
        },
      }"
    >
      <PvColumn field="validity" header="Validity" :editor="false">
        <template #body="{ data }">
          {{ validationResults[data[props.keyField]]?.valid ? 'Valid' : 'Invalid' }}
        </template>
      </PvColumn>
      <PvColumn
        v-for="col of tableColumns"
        :key="col.field"
        :header="col.header"
        :field="col.field"
        :editor="isColumnEditable(col.field)"
      >
        <template #body="{ data, field }">
          <div :class="{ 'invalid-cell': !isFieldValid(data, field) }">
            {{ data[field] }}
          </div>
        </template>
        <template #editor="{ data, field }">
          <InputText v-model="data[field]" autofocus fluid />
        </template>
      </PvColumn>
      <PvColumn :row-editor="true" style="width: 10%; min-width: 8rem" bodyStyle="text-align:center" />
    </PvDataTable>
  </div>
  <div v-else>
    <h2>No data available</h2>
    {{ props.students }}
    {{ tableColumns }}
  </div>
</template>
<script setup>
import { ref, watch, computed } from 'vue';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import _forEach from 'lodash/forEach';
import _startCase from 'lodash/startCase';
import _isEmpty from 'lodash/isEmpty';
import _get from 'lodash/get';
import InputText from 'primevue/inputtext';
const props = defineProps({
  students: {
    type: Object,
    required: true,
  },
  mappings: {
    type: Object,
    required: true,
  },
  keyField: {
    type: String,
    required: true,
  },
});
const tableColumns = ref([]);
const editingRows = ref([]);
const validationResults = ref({});

// Computed properties for validation stats
const totalCount = computed(() => (_isEmpty(props.students) ? 0 : props.students.length));
// Computed property for sorted students data
const sortedStudents = computed(() => {
  if (!props.students) return [];
  return [...props.students].sort((a, b) => {
    const aValid = validationResults.value[a[props.keyField]]?.valid ?? false;
    const bValid = validationResults.value[b[props.keyField]]?.valid ?? false;
    return aValid - bValid; // Sort invalid entries first
  });
});

const validCount = computed(() => {
  if (_isEmpty(validationResults.value)) return 0;
  let count = 0;
  Object.values(validationResults.value).forEach((result) => {
    if (result.valid) count++;
  });
  return count;
});

// Watch for changes in students data
watch(
  () => props.students,
  () => {
    console.log('watch students', props.students);
    if (_isEmpty(props.students)) return;
    tableColumns.value = generateColumns(props.students[0]);
    validateAllStudents();
  },
  { immediate: true, deep: true },
);

// {valid: true, errors: []}

function generateColumns(rawJson) {
  let columns = [];
  const columnValues = Object.keys(rawJson);
  _forEach(columnValues, (col) => {
    const mappedCol = findMappedColumnByField(col) ?? 'Not Incl.';
    let dataType = typeof rawJson[col];
    if (dataType === 'object') {
      if (rawJson[col] instanceof Date) dataType = 'date';
    }
    columns.push({
      field: col,
      header: _startCase(mappedCol),
      dataType: dataType,
    });
  });
  return columns;
}

/**
 * Given a column in the CSV, this function will return
 * the corresponding ROAR column name. If the column is not mapped, it will return null.
 * @param field The field to find
 * @returns {string|null} The mapped column name or null if not found
 */
function findMappedColumnByField(field) {
  for (const category in props.mappings) {
    for (const column in props.mappings[category]) {
      if (props.mappings[category][column] === field) return column;
    }
  }
  return null;
}

function isColumnEditable(column) {
  return column !== props.keyField;
}

// Handle row edit save
function onCellEditSave(event) {
  let { data, newValue, field } = event;

  // Prevent the user from changing the key field
  if (!isColumnEditable(field)) {
    return;
  }

  data[field] = newValue;

  validateStudent(data);
}

// Function to validate all students
function validateAllStudents() {
  if (_isEmpty(props.students)) return;
  props.students.forEach((student) => {
    validateStudent(student);
  });
}

// Function to validate a single student
function validateStudent(student) {
  try {
    const result = validityCheck(student);
    validationResults.value[student[props.keyField]] = result;
    return result;
  } catch (error) {
    console.error('Validation error:', error);
    validationResults.value[student[props.keyField]] = {
      valid: false,
      errors: [error.message],
    };
    return { valid: false, errors: [error.message] };
  }
}

// Function to check if a specific field is valid
function isFieldValid(data, field) {
  return validationResults.value[data[props.keyField]] ?? true;
}

function validityCheck(row) {
  const passwordField = props.mappings.required.password;
  if (!isPasswordValid(row[passwordField])) {
    return { valid: false, errors: ['Password must be at least 6 characters long and contain at least one letter'] };
  }
  return { valid: true, errors: [] };
}
function isPasswordValid(password) {
  return password.length >= 6 && /[a-zA-Z]/.test(password);
}
</script>

<style>
.invalid-cell {
  background-color: var(--red-50);
  color: var(--red-900);
}
</style>
