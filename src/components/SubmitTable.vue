<template>
  <div v-if="!_isEmpty(props.students) && tableColumns.length > 0" class="flex flex-column">
    <div class="flex flex-row justify-content-between align-items-center mb-3">
      <div class="flex flex-row align-items-center gap-2">
        <span class="font-bold">Valid Records:</span>
        <span :class="{ 'text-green-500': validCount === totalCount, 'text-red-500': validCount !== totalCount }">
          {{ validCount }}/{{ totalCount }}
        </span>
        <slot />
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
          <span
            v-tooltip.top="validationResults[data[props.keyField]]?.errors.join(',\n')"
            :class="{
              'text-green-500': validationResults[data[props.keyField]]?.valid,
              'text-red-500': !validationResults[data[props.keyField]]?.valid,
            }"
            >{{ validationResults[data[props.keyField]]?.valid ? 'Valid' : 'Invalid' }}</span
          >
        </template>
      </PvColumn>
      <PvColumn v-for="col of tableColumns" :key="col.field" :header="col.header" :field="col.field" :editor="true">
        <template #body="{ data, field }">
          <div>
            {{ data[field] }}
          </div>
        </template>
        <template #editor="{ data, field }">
          <InputText v-model="data[field]" autofocus fluid />
        </template>
      </PvColumn>
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

/**
 * DataTable utilities
 */

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

function generateColumns(rawJson) {
  let columns = [];
  const columnValues = Object.keys(rawJson);
  _forEach(columnValues, (col) => {
    const mappedCol = findMappedColumnByField(col) ?? null;
    let dataType = typeof rawJson[col];
    if (dataType === 'object') {
      if (rawJson[col] instanceof Date) dataType = 'date';
    }
    if (mappedCol) {
      columns.push({
        field: col,
        header: _startCase(mappedCol),
        dataType: dataType,
      });
    }
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

// Handle row edit save
function onCellEditSave(event) {
  let { data, newValue, field } = event;

  data[field] = newValue;

  validateStudent(data);
}

/**
 * Handle student validation
 */
const emit = defineEmits(['validationUpdate']);
const totalCount = computed(() => (_isEmpty(props.students) ? 0 : props.students.length));
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

// Watch validation results and emit status
watch(
  [validCount, totalCount],
  ([newCount, total]) => {
    console.log('validation watcher', newCount, total);
    const allValid = newCount === total;
    emit('validationUpdate', allValid);
  },
  { immediate: true },
);

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

// Validate a given row
function validityCheck(row) {
  const keyField = props.keyField;
  const passwordField = props.mappings.required.password;
  const gradeField = props.mappings.required.grade;
  const dobField = props.mappings.required.dob;
  const errors = [];
  // check that required fields are filled out
  if (!_get(row, keyField)) {
    errors.push('Username/Email is required');
  }
  if (!_get(row, gradeField)) {
    errors.push('Grade is required');
  }
  if (!_get(row, dobField)) {
    errors.push('Date of Birth is required');
  }
  // check that password is valid
  if (!isPasswordValid(row[passwordField])) {
    errors.push('Password must be at least 6 characters long and contain at least one letter');
  }
  return { valid: _isEmpty(errors), errors };
}
function isPasswordValid(password) {
  if (!password) return false;
  return password.length >= 6 && /[a-zA-Z]/.test(password);
}
</script>
