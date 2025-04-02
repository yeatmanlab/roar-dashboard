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
    <Stepper value="1" linear class="w-full">
      <StepList>
        <Step value="1">Upload</Step>
        <Step value="2">Required</Step>
        <Step value="3">Optional</Step>
        <Step value="4">Organizations</Step>
        <Step value="5">Review</Step>
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
                    <template #header> {{ col.header }}</template>
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
              <h2>Required Fields</h2>
              <div class="flex flex-column gap-3 p-4">
                <div>
                  <label class="mr-2">Use Email</label>
                  <PvCheckbox binary v-model="usingEmail" />
                </div>
                <div v-if="usingEmail" class="flex flex-row gap-2">
                  <div>
                    <span>Email</span>
                    <p>The email address of the student.</p>
                  </div>
                  <Dropdown class="w-full dropdown" :options="csv_columns" v-model="mappedColumns.required.email" />
                </div>
                <div v-else class="flex flex-row gap-2">
                  <div>
                    <span>Username</span>
                    <p>The username of the student.</p>
                  </div>
                  <Dropdown class="w-full dropdown" :options="csv_columns" v-model="mappedColumns.required.username" />
                </div>
                <div class="flex flex-row gap-2">
                  <div>
                    <span>Password</span>
                    <p>The password of the student.</p>
                  </div>
                  <Dropdown class="w-full dropdown" :options="csv_columns" v-model="mappedColumns.required.password" />
                </div>
                <div class="flex flex-row gap-2">
                  <div>
                    <span>Date of Birth</span>
                    <p>The date of birth of the student.</p>
                  </div>
                  <Dropdown class="w-full dropdown" :options="csv_columns" v-model="mappedColumns.required.dob" />
                </div>
                <div class="flex flex-row gap-2">
                  <div>
                    <span>Grade</span>
                    <p>The grade of the student.</p>
                  </div>
                  <Dropdown class="w-full dropdown" :options="csv_columns" v-model="mappedColumns.required.grade" />
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Optional Fields -->
        <StepPanel v-slot="{ activateCallback }" value="3">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('2')" />
            <h2>Optional Fields</h2>
            <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('4')" />
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
        <StepPanel v-slot="{ activateCallback }" value="4">
          <div class="py-3 flex justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('3')" />
            <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('5')" />
          </div>
          <div class="step-container">
            <div
              class="flex flex-column gap-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <div>
                <label class="mr-2">All students to same org</label>
                <PvCheckbox binary v-model="usingOrgPicker" />
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
        <StepPanel v-slot="{ activateCallback }" value="5">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('4')" />
          </div>
          <div class="step-container">
            <div
              class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex justify-center items-center font-medium w-full"
            >
              <h2>Review</h2>
              <div>Display all selections before submission</div>
            </div>
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
import PvCheckbox from 'primevue/checkbox';
import { csvFileToJson } from '@/helpers';
import _isEmpty from 'lodash/isEmpty';
import _startCase from 'lodash/startCase';
import OrgPicker from '@/components/OrgPicker.vue';
import PvDataTable from 'primevue/datatable';
import PvColumn from 'primevue/column';
import _forEach from 'lodash/forEach';

const rawStudentFile = ref({});
const tableColumns = ref([]);
const csv_columns = ref([]);
const usingEmail = ref(false);
const usingOrgPicker = ref(true);
const isFileUploaded = ref(false);
const optionalFields = ref([
  { field: 'firstName', label: 'First Name', description: 'First name of the student' },
  { field: 'middleName', label: 'Middle Name', description: 'Middle name of the student' },
  { field: 'lastName', label: 'Last Name', description: 'Last name of the student' },
  { field: 'gender', label: 'Gender', description: 'Gender of the student' },
  { field: 'race', label: 'Race', description: 'Race of the student' },
  { field: 'testData', label: 'Test Data', description: 'Test data of the student' },
  { field: 'unenroll', label: 'Unenroll', description: 'Unenroll of the student' },
  { field: 'stateId', label: 'State ID', description: 'State ID of the student' },
  { field: 'ellStatus', label: 'English Language Learner', description: 'English Language Learner of the student' },
  { field: 'frlStatus', label: 'Free-Reduced Lunch', description: 'Free-Reduced Lunch of the student' },
  { field: 'iepStatus', label: 'IEP Status', description: 'IEP Status of the student' },
  { field: 'hispanicEthnicity', label: 'Hispanic Ethinicity', description: 'Hispanic Ethinicity of the student' },
  { field: 'homeLanguage', label: 'Home Language', description: 'Home Language of the student' },
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
  optional: Object.fromEntries(optionalFields.value.map((field) => [field.field, null])),
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
.dropdown {
  height: 2.5rem;
}
.datatable {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
}
</style>
