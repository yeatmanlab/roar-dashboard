<template>
  <div class="page-container">
    <div>
      <h2>Register Students</h2>
      <!-- Notes: -->
      <!-- <ul>
        <li>Maybe need to work in a data preview</li>
        <li>Additional enhancement, add a way to create students via editable table</li>
        <li>After review , during after submit, have a view that shows some summery / next steps</li>
        <li>Move Optional step to before Org selection</li>
      </ul> -->
    </div>
    <Stepper value="1" class="w-full">
      <StepList>
        <Step value="1">Upload</Step>
        <Step value="2">Required</Step>
        <Step value="3">Names</Step>
        <Step value="4">Demographics</Step>
        <Step value="5">Optional</Step>
        <Step value="6">Organizations</Step>
        <Step value="7">Review</Step>
        <Step value="8">Preview</Step>
      </StepList>
      <StepPanels>
        <!-- Upload CSV -->
        <StepPanel v-slot="{ activateCallback }" value="1">
          <div v-if="!_isEmpty(rawStudentFile)" class="flex py-3 justify-content-end">
            <Button
              label="Next"
              :disabled="!readyToProgress('2')"
              icon="pi pi-arrow-right"
              @click="activateCallback('2')"
            />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex-auto flex justify-center items-center font-medium w-full"
            >
              <div v-if="_isEmpty(rawStudentFile)" class="text-gray-500 surface-100 border-round-top-md">
                <PvFileUpload
                  name="massUploader[]"
                  class="bg-primary text-white border-none border-round hover:bg-red-900"
                  custom-upload
                  accept=".csv"
                  auto
                  :show-upload-button="false"
                  :show-cancel-button="false"
                  @uploader="onFileUpload($event, activateCallback)"
                >
                  <template #empty>
                    <div class="extra-height ml-6 text-gray-500">
                      <p>Drag and drop files to here to upload.</p>
                    </div>
                  </template>
                </PvFileUpload>
              </div>
              <div v-else>
                <Button label="Upload a different File" @click="resetUpload()" />
                <PvDataTable
                  ref="dataTable"
                  :value="rawStudentFile"
                  show-gridlines
                  :row-hover="true"
                  :resizable-columns="true"
                  paginator
                  :always-show-paginator="false"
                  :rows="10"
                  class="datatable"
                >
                  <PvColumn v-for="col of tableColumns" :key="col.field" :field="col.field">
                    <template #header> <b></b>{{ col.header }}</template>
                  </PvColumn>
                </PvDataTable>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Required Fields -->
        <StepPanel v-slot="{ activateCallback }" value="2">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('1')" />
            <h2 class="step-header">Required Fields</h2>
            <Button
              label="Next"
              :disabled="!readyToProgress('3')"
              icon="pi pi-arrow-right"
              iconPos="right"
              @click="activateCallback('3')"
            />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <div class="flex flex-column gap-3 p-4">
                <div>
                  <label class="mr-2">Use Email</label>
                  <PvToggleSwitch v-model="usingEmail" />
                </div>
                <div v-if="usingEmail" class="flex flex-row gap-2">
                  <div>
                    <span>Email</span>
                    <p>The email address of the student.</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.required.email"
                  />
                </div>
                <div v-else class="flex flex-row gap-2">
                  <div>
                    <span>Username</span>
                    <p>The username of the student.</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.required.username"
                  />
                </div>
                <div class="flex flex-row gap-2">
                  <div>
                    <span>Password</span>
                    <p>The password of the student.</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.required.password"
                  />
                </div>
                <div class="flex flex-row gap-2">
                  <div>
                    <span>Date of Birth</span>
                    <p>The date of birth of the student.</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.required.dob"
                  />
                </div>
                <div class="flex flex-row gap-2">
                  <div>
                    <span>Grade</span>
                    <p>The grade of the student.</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.required.grade"
                  />
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Names Fields -->
        <StepPanel v-slot="{ activateCallback }" value="3">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('2')" />
            <h2 class="step-header">Names</h2>
            <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('4')" />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <div class="flex flex-column gap-3 p-4">
                <div v-for="(value, key) in nameFields" class="flex flex-row gap-2">
                  <div>
                    <span> {{ value.label }}</span>
                    <p>{{ value.description }}</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.names[value.field]"
                  />
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Demographic Fields -->
        <StepPanel v-slot="{ activateCallback }" value="4">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('3')" />
            <h2 class="step-header">Demographics Fields</h2>
            <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('5')" />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <div class="flex flex-column gap-3 p-4">
                <div v-for="(value, key) in demographicFields" class="flex flex-row gap-2">
                  <div class="flex flex-row">
                    <span> {{ value.label }}</span>
                    <p>{{ value.description }}</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.optional[value.field]"
                  />
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Optional Fields -->
        <StepPanel v-slot="{ activateCallback }" value="5">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('4')" />
            <h2 class="step-header">Optional Fields</h2>
            <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('6')" />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <div class="flex flex-column gap-3 p-4">
                <div v-for="(value, key) in optionalFields" class="flex flex-row gap-2">
                  <div>
                    <span> {{ value.label }}</span>
                    <p>{{ value.description }}</p>
                  </div>
                  <Dropdown
                    showClear
                    class="w-full dropdown"
                    :options="csv_columns"
                    v-model="mappedColumns.optional[value.field]"
                  />
                </div>
              </div>
            </div>
          </div>
        </StepPanel>

        <!-- Organizations -->
        <StepPanel v-slot="{ activateCallback }" value="6">
          <div class="py-3 flex justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('5')" />
            <h2 class="step-header">Organizations</h2>
            <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('7')" />
          </div>
          <div class="step-container">
            <div
              class="flex flex-column gap-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <div>
                <label class="mr-2">All students to same org</label>
                <PvToggleSwitch binary v-model="usingOrgPicker" />
              </div>
              <div v-if="usingOrgPicker">
                <OrgPicker @selection="selection($event)" />
              </div>
              <div v-else>
                <div class="flex flex-column gap-3 p-4">
                  <div v-for="(value, key) in mappedColumns.organizations" class="flex flex-row gap-2">
                    <div>
                      <span> {{ _startCase(key) }}</span>
                    </div>
                    <Dropdown
                      showClear
                      class="w-full dropdown"
                      :options="csv_columns"
                      v-model="mappedColumns.organizations[key]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Review -->
        <StepPanel v-slot="{ activateCallback }" value="7">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('6')" />
            <h2 class="step-header">Review</h2>
            <Button label="Submit" severity="primary" icon="pi pi-check" @click="activateCallback('8')" />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex flex-column justify-center items-center font-medium w-full"
            >
              <div class="flex flex-row w-full gap-2">
                <div class="flex-flex-column w-full">
                  <!-- Required Fields -->
                  <div class="review-section-container">
                    <div class="flex flex-row justify-between mb-2">
                      <h3 class="step-header">Required Fields</h3>
                      <Button
                        label="Edit"
                        severity="secondary"
                        icon="pi pi-arrow-left"
                        @click="activateCallback('2')"
                      />
                    </div>
                    <div class="flex flex-row justify-between">
                      <span>ROAR Fields</span>
                      <span>Your CSV Fields</span>
                    </div>
                    <div v-for="(value, key) in mappedColumns.required" class="review-section-item">
                      <span>{{ _startCase(key) }}</span>
                      <span class="text-gray-500">{{ value ?? '--' }}</span>
                    </div>
                  </div>
                  <!-- Demographic Fields -->
                  <h3>Demographic Fields</h3>
                  <div class="review-section-container">
                    <div class="flex flex-row justify-between mb-2">
                      <span>ROAR Fields</span>
                      <span>Your CSV Fields</span>
                    </div>
                    <div v-for="(value, key) in mappedColumns.demographic" class="review-section-item">
                      <span>{{ _startCase(key) }}</span>
                      <span class="text-gray-500">{{ value ?? '--' }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex-flex-column w-full">
                  <!-- Names Fields -->
                  <h3>Names Fields</h3>
                  <div class="review-section-container">
                    <div class="flex flex-row justify-between mb-2">
                      <span>ROAR Fields</span>
                      <span>Your CSV Fields</span>
                    </div>
                    <div v-for="(value, key) in mappedColumns.names" class="review-section-item">
                      <span>{{ _startCase(key) }}</span>
                      <span class="text-gray-500">{{ value ?? '--' }}</span>
                    </div>
                  </div>
                  <!-- Organizations Fields -->
                  <h3>Organizations Fields</h3>
                  <div class="review-section-container">
                    <div class="flex flex-row justify-between mb-2">
                      <span>ROAR Fields</span>
                      <span>Your CSV Fields</span>
                    </div>
                    <div v-for="(value, key) in mappedColumns.organizations" class="review-section-item">
                      <span>{{ _startCase(key) }}</span>
                      <span class="text-gray-500">{{ value ?? '--' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <StepPanel v-slot="{ activateCallback }" value="8">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('7')" />
            <h2 class="step-header">Preview & Submit</h2>
            <Button label="" />
          </div>
          <div class="step-container">
            <SubmitTable
              v-if="rawStudentFile"
              :students="rawStudentFile"
              :key-field="usingEmail ? 'email' : 'username'"
            />
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>
<script setup>
import { ref, toRaw } from 'vue';
import Dropdown from 'primevue/dropdown';
import Stepper from 'primevue/stepper';
import Step from 'primevue/step';
import StepList from 'primevue/steplist';
import StepPanel from 'primevue/steppanel';
import Button from 'primevue/button';
import PvFileUpload from 'primevue/fileupload';
import PvToggleSwitch from 'primevue/toggleswitch';
import { csvFileToJson } from '@/helpers';
import _isEmpty from 'lodash/isEmpty';
import _startCase from 'lodash/startCase';
import OrgPicker from '@/components/OrgPicker.vue';
import PvDataTable from 'primevue/datatable';
import PvColumn from 'primevue/column';
import _forEach from 'lodash/forEach';
import SubmitTable from '@/components/SubmitTable.vue';

const rawStudentFile = ref({});
const tableColumns = ref([]);
const csv_columns = ref([]);
const usingEmail = ref(false);
const usingOrgPicker = ref(true);
const isFileUploaded = ref(false);
const nameFields = ref([
  { field: 'firstName', label: 'First Name', description: 'First name of the student' },
  { field: 'middleName', label: 'Middle Name', description: 'Middle name of the student' },
  { field: 'lastName', label: 'Last Name', description: 'Last name of the student' },
]);
const demographicFields = ref([
  { field: 'gender', label: 'Gender', description: 'Gender of the student' },
  { field: 'race', label: 'Race', description: 'Race of the student' },
  { field: 'ellStatus', label: 'English Language Learner', description: 'English Language Learner of the student' },
  { field: 'frlStatus', label: 'Free-Reduced Lunch', description: 'Free-Reduced Lunch of the student' },
  { field: 'iepStatus', label: 'IEP Status', description: 'IEP Status of the student' },
  { field: 'hispanicEthnicity', label: 'Hispanic Ethinicity', description: 'Hispanic Ethinicity of the student' },
  { field: 'homeLanguage', label: 'Home Language', description: 'Home Language of the student' },
]);
const optionalFields = ref([
  { field: 'testData', label: 'Test Data', description: 'Test data of the student' },
  { field: 'unenroll', label: 'Unenroll', description: 'Unenroll of the student' },
  { field: 'stateId', label: 'State ID', description: 'State ID of the student' },
  { field: 'pid', label: 'PID', description: 'PID of the student' },
]);

const mappedColumns = ref({
  required: {
    username: null,
    email: null,
    password: null,
    dob: null,
    grade: null,
  },
  names: Object.fromEntries(nameFields.value.map((field) => [field.field, null])),
  optional: Object.fromEntries(optionalFields.value.map((field) => [field.field, null])),
  demographic: Object.fromEntries(demographicFields.value.map((field) => [field.field, null])),
  organizations: {
    districts: [],
    schools: [],
    classes: [],
    groups: [],
    families: [],
  },
});
const selection = (selected) => {
  console.log('selected', selected);
  // selectedOrgs.value = selected;
  mappedColumns.value.organizations = selected;
};

function resetUpload() {
  rawStudentFile.value = {};
  tableColumns.value = [];
  csv_columns.value = [];
  isFileUploaded.value = false;
}

function generateColumns(rawJson) {
  console.log('genColumns rawJson', rawJson);
  let columns = [];
  const columnValues = Object.keys(rawJson);
  _forEach(columnValues, (col) => {
    let dataType = typeof rawJson[col];
    if (dataType === 'object') {
      if (rawJson[col] instanceof Date) dataType = 'date';
    }
    columns.push({
      field: col,
      header: _startCase(col),
      dataType: dataType,
    });
  });
  console.log('genColumns columns', columns);
  return columns;
}

const onFileUpload = async (event, activateCallback) => {
  rawStudentFile.value = await csvFileToJson(event.files[0]);
  console.log('rawStudentFile', rawStudentFile.value);
  tableColumns.value = generateColumns(rawStudentFile.value[0]);
  csv_columns.value = Object.keys(toRaw(rawStudentFile.value[0]));
  // activateCallback('2');
};

// This function will return a boolean, true if the user has filled out the information required to proceed to the targetStep.
const readyToProgress = (targetStep) => {
  console.log('invoking readyToProgress', targetStep);
  if (targetStep === '2') return !_isEmpty(rawStudentFile.value);

  if (targetStep === '3') {
    // Check that mappedColumns has all the required fields not null
    return (
      (mappedColumns.value.required.username || mappedColumns.value.required.email) &&
      mappedColumns.value.required.password &&
      mappedColumns.value.required.dob &&
      mappedColumns.value.required.grade
    );
  }

  if (targetStep === '5') {
    return (
      (!_isEmpty(mappedColumns.value.organizations.districts) &&
        !_isEmpty(mappedColumns.value.organizations.schools) &&
        !_isEmpty(mappedColumns.value.organizations.classes)) ||
      !_isEmpty(mappedColumns.value.organizations.groups) ||
      !_isEmpty(mappedColumns.value.organizations.families)
    );
  }
};

const submit = () => {
  console.log('submit', mappedColumns.value);
};
</script>
<style>
.page-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 2rem;
}
.step-container {
  width: 100%;
  height: 100%;
  display: flex;
  padding: 0 2rem;
}
.step-header {
  margin: 0;
}
.dropdown {
  height: 2.5rem;
}
.datatable {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
}
.review-section-container {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
  padding: 1rem;
  gap: 0.5rem;
}
.review-section-item {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
</style>
