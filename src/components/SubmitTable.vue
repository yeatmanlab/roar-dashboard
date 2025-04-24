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
      v-model:editing-rows="editingRows"
      :value="sortedStudents"
      show-gridlines
      :row-hover="true"
      :resizable-columns="true"
      paginator
      :always-show-paginator="false"
      :rows="10"
      class="datatable"
      edit-mode="cell"
      data-key="id"
      :pt="{
        table: { style: 'min-width: 50rem' },
        column: {
          bodycell: ({ state }) => ({
            class: [{ '!py-0': state['d_editing'] }],
          }),
        },
      }"
      @cell-edit-complete="onCellEditSave"
    >
      <PvColumn field="validity" header="Ready to Submit?" :editor="false">
        <template #body="{ data }">
          <span
            v-tooltip.top="validationResults[data['rowKey']]?.errors.join(',\n')"
            :class="{
              'text-green-500': validationResults[data['rowKey']]?.valid,
              'text-red-500': !validationResults[data['rowKey']]?.valid,
            }"
            >{{ validationResults[data['rowKey']]?.valid ? 'Ready to Submit!' : 'Not Ready' }}</span
          >
          <i
            v-if="!validationResults[data['rowKey']]?.valid"
            v-tooltip.top="validationResults[data['rowKey']]?.errors.join(',\n')"
            class="pi pi-question-circle ml-2 text-red-500"
          />
        </template>
      </PvColumn>
      <PvColumn v-for="col of tableColumns" :key="col.field" :field="col.field" :editor="true">
        <template #header>
          <div class="flex flex-column">
            <div class="flex gap-2 font-bold">
              {{ col.header }}
              <i v-tooltip.top="'Click on a cell below to edit its value.'" class="pi pi-pen-to-square" />
            </div>
            <span class="text-gray-500">{{ findMappedColumn(col.field) }}</span>
          </div>
        </template>
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
    <h2>No data available.</h2>
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
  usingOrgPicker: {
    type: Boolean,
    default: true,
  },
  usingEmail: {
    type: Boolean,
    default: false,
  },
});
const tableColumns = ref([]);
const editingRows = ref([]);
const validationResults = ref({});

const headerOverrides = {
  dob: 'Date of Birth',
  first: 'First Name',
  middle: 'Middle Name',
  last: 'Last Name',
  ellStatus: 'English Language Learner Status',
  frlStatus: 'Free and Reduced Lunch Status',
  iepStatus: 'IEP Status',
  pid: 'PID',
};

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
    let dataType = typeof rawJson[col];
    if (col !== 'rowKey') {
      columns.push({
        field: col,
        header: headerOverrides[col] || _startCase(col),
        dataType: dataType,
      });
    }
  });
  return columns;
}

function findMappedColumn(column) {
  for (const category in props.mappings) {
    const csvColumn = props.mappings[category][column];
    if (csvColumn && Array.isArray(csvColumn)) return csvColumn.join(', ');
    if (csvColumn) return csvColumn;
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
    const aValid = validationResults.value[a['rowKey']]?.valid ?? false;
    const bValid = validationResults.value[b['rowKey']]?.valid ?? false;
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
    validationResults.value[student['rowKey']] = result;
    return result;
  } catch (error) {
    console.error('Validation error:', error);
    validationResults.value[student['rowKey']] = {
      valid: false,
      errors: [error.message],
    };
    return { valid: false, errors: [error.message] };
  }
}

// Validate a given row
function validityCheck(row) {
  const errors = [];
  // check that required fields are filled out
  if (props.usingEmail) {
    if (!_get(row, 'email')) {
      errors.push('Email is required');
    } else if (!isEmailValid(row['email'])) {
      errors.push('Email is improperly formatted');
    }
  } else {
    if (!_get(row, 'username')) {
      errors.push('Username is required');
    }
  }
  if (!_get(row, 'grade')) {
    errors.push('Grade is required');
  }
  if (!_get(row, 'dob')) {
    errors.push('Date of Birth is required');
  }
  // check that password is valid
  if (!isPasswordValid(row['password'])) {
    errors.push('Password must be at least 6 characters long and contain at least one letter');
  }

  // If not using the org picker, check that a district and school, or a group are selected
  if (!props.usingOrgPicker) {
    if (!(_get(row, 'districts') && _get(row, 'schools')) && !_get(row, 'groups')) {
      errors.push('District, School, or Group is required');
    }
  }
  return { valid: _isEmpty(errors), errors };
}
function isEmailValid(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
function isPasswordValid(password) {
  if (!password) return false;
  return password.length >= 6 && /[a-zA-Z]/.test(password);
}
</script>
