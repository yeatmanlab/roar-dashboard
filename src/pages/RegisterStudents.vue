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
                  @uploader="onFileUpload($event)"
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
                    <template #header>
                      <b>{{ col.header }}</b>
                    </template>
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
                    v-model="mappedColumns.demographics[value.field]"
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
            <Button
              :disabled="!readyToProgress('7')"
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              @click="activateCallback('7')"
            />
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
                <OrgPicker @selection="orgSelection($event)" />
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
            <Button
              label="Submit"
              severity="primary"
              icon="pi pi-check"
              @click="
                activateCallback('8');
                showSubmitTable = true;
              "
            />
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
                    <div v-for="(value, key) in mappedColumns.demographics" class="review-section-item">
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
        <!-- Preview & Submit -->
        <StepPanel v-slot="{ activateCallback }" value="8">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('7')" />
            <h2 class="step-header">Preview & Submit</h2>
            <Button
              label="Submit"
              severity="primary"
              icon="pi pi-check"
              @click="submit()"
              :disabled="!allStudentsValid"
              v-tooltip.left="!allStudentsValid ? 'Please fix validation errors before submitting' : ''"
            />
          </div>
          <div class="step-container flex flex-column">
            <div v-if="submitting !== SubmitStatus.IDLE">
              <div class="flex flex-column gap-3">
                <h3 v-if="submitting === SubmitStatus.TRANSFORMING" class="step-header">
                  <i class="pi pi-spinner pi-spin mr-2"></i>Formatting Students...
                </h3>
                <h3 v-if="submitting === SubmitStatus.SUBMITTING" class="step-header">
                  <i class="pi pi-spinner pi-spin mr-2"></i>Submitting...
                </h3>
                <h3 v-if="submitting === SubmitStatus.COMPLETE" class="step-header">Upload Complete.</h3>
              </div>
            </div>
            <SubmitTable
              v-if="showSubmitTable"
              :students="rawStudentFile"
              :mappings="mappedColumns"
              :key-field="usingEmail ? mappedColumns.required.email : mappedColumns.required.username"
              @validation-update="handleValidationUpdate"
            />
            <Button label="Add User" icon="pi pi-plus" severity="secondary" class="mt-3" @click="addUser" />
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>
<script setup>
import { ref, toRaw, onMounted } from 'vue';
import Dropdown from 'primevue/dropdown';
import Stepper from 'primevue/stepper';
import Step from 'primevue/step';
import StepList from 'primevue/steplist';
import StepPanel from 'primevue/steppanel';
import Button from 'primevue/button';
import PvFileUpload from 'primevue/fileupload';
import PvToggleSwitch from 'primevue/toggleswitch';
import { csvFileToJson } from '@/helpers';
import { fetchOrgByName } from '@/helpers/query/orgs';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import _startCase from 'lodash/startCase';
import OrgPicker from '@/components/OrgPicker.vue';
import PvDataTable from 'primevue/datatable';
import PvColumn from 'primevue/column';
import _forEach from 'lodash/forEach';
import _chunk from 'lodash/chunk';
import _set from 'lodash/set';
import _remove from 'lodash/remove';
import SubmitTable from '@/components/SubmitTable.vue';

const rawStudentFile = ref([]);
const tableColumns = ref([]);
const csv_columns = ref([]);
const usingEmail = ref(false);
const usingOrgPicker = ref(true);
const isFileUploaded = ref(false);
const showSubmitTable = ref(false);
const allStudentsValid = ref(false);

const SubmitStatus = {
  IDLE: 'idle',
  TRANSFORMING: 'transforming',
  SUBMITTING: 'submitting',
  COMPLETE: 'complete',
};
const submitting = ref(SubmitStatus.IDLE);

const nameFields = ref([
  { field: 'first', label: 'First Name', description: 'First name of the student' },
  { field: 'middle', label: 'Middle Name', description: 'Middle name of the student' },
  { field: 'last', label: 'Last Name', description: 'Last name of the student' },
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
  demographics: Object.fromEntries(demographicFields.value.map((field) => [field.field, null])),
  organizations: {
    districts: null,
    schools: null,
    classes: null,
    groups: null,
    families: null,
  },
});
const selectedOrgs = ref({
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: [],
});
const orgSelection = (selected) => {
  selectedOrgs.value = selected;
};

const handleValidationUpdate = (isValid) => {
  allStudentsValid.value = isValid;
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
    if (col === 'rowKey') return;
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

const onFileUpload = async (event) => {
  const rawFile = await csvFileToJson(event.files[0]);
  rawStudentFile.value = rawFile.map((row, index) => {
    return {
      rowKey: index,
      ...row,
    };
  });
  console.log('rawStudentFile', rawStudentFile.value);
  tableColumns.value = generateColumns(rawStudentFile.value[0]);
  csv_columns.value = _remove(Object.keys(toRaw(rawStudentFile.value[0])), (col) => col !== 'rowKey');
};

/**
 * Checks if the user has filled out the information required to proceed to the targetStep.
 * @param {string} targetStep - The step to check.
 * @returns {boolean} True if the user has filled out the information required to proceed to the targetStep, false otherwise.
 */
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

  if (targetStep === '7') {
    if (usingOrgPicker.value) {
      // Check that selectedOrgs has district, school and class populated OR group OR family populated
      return (
        (!_isEmpty(selectedOrgs.value.districts) &&
          !_isEmpty(selectedOrgs.value.schools) &&
          !_isEmpty(selectedOrgs.value.classes)) ||
        !_isEmpty(selectedOrgs.value.groups) ||
        !_isEmpty(selectedOrgs.value.families)
      );
    } else {
      // Check that mappedColumns.organizations has all the required fields not null
      return (
        (mappedColumns.value.organizations.districts &&
          mappedColumns.value.organizations.schools &&
          mappedColumns.value.organizations.classes) ||
        mappedColumns.value.organizations.groups ||
        mappedColumns.value.organizations.families
      );
    }
  }

  return true;
};

/**
 * Organization handling
 */
// Cache for organization IDs to avoid repeated API calls
const orgCache = ref({
  districts: new Map(),
  schools: new Map(),
  classes: new Map(),
  groups: new Map(),
  families: new Map(),
});

// Helper function to get org ID (uses cache if available)
const getOrgId = async (orgType, orgName, selectedDistrict = null, selectedSchool = null) => {
  console.log('invoking getOrgId', orgType, orgName, selectedDistrict, selectedSchool);
  if (!orgName) return null;

  const cacheKey =
    orgType === 'schools'
      ? `${orgName}-${selectedDistrict}`
      : orgType === 'classes'
      ? `${orgName}-${selectedSchool}`
      : orgName;

  // Check cache first
  if (orgCache.value[orgType].has(cacheKey)) {
    return orgCache.value[orgType].get(cacheKey);
  }

  // If not in cache, fetch and cache the result
  try {
    const org = await fetchOrgByName(orgType, orgName, { value: selectedDistrict }, { value: selectedSchool });
    console.log('Fetched org:', org);

    if (org[0]?.id) {
      orgCache.value[orgType].set(cacheKey, org[0].id);
      return org[0].id;
    }
  } catch (error) {
    console.error(`Error fetching ${orgType} ID for ${orgName}:`, error);
  }
  return null;
};

/**
 * Submission handlers
 */
const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const transformStudentData = async (rawStudent) => {
  const transformedStudent = {};

  // Handle required fields
  Object.entries(mappedColumns.value.required).forEach(([key, csvField]) => {
    if (csvField) {
      if (key === 'username') {
        _set(transformedStudent, 'email', `${rawStudent[csvField]}@roar-auth.com`);
      } else if (['email', 'password'].includes(key)) {
        _set(transformedStudent, key, rawStudent[csvField]);
      } else {
        _set(transformedStudent, `userData.${key}`, rawStudent[csvField]);
      }
    }
  });

  // Handle name fields
  Object.entries(mappedColumns.value.names).forEach(([key, csvField]) => {
    if (csvField) _set(transformedStudent, `userData.name.${key}`, rawStudent[csvField]);
  });

  // Handle demographic fields
  Object.entries(mappedColumns.value.demographics).forEach(([key, csvField]) => {
    if (csvField) _set(transformedStudent, `userData.${key}`, rawStudent[csvField]);
  });

  // Handle optional fields
  Object.entries(mappedColumns.value.optional).forEach(([key, csvField]) => {
    if (csvField) {
      _set(transformedStudent, `userData.${key}`, rawStudent[csvField]);
    }
  });

  // Handle organizations
  if (!usingOrgPicker.value) {
    // If the org picker is not being used, we are given the names of the orgs as values.
    // To submit, we need to send orgIds. Education orgs, districts, schools, and classes
    // are fetched on order. First district, then school, then class. If any of these are not
    // found, it will skip the rest as they are required to find the class.
    let studentDistrictId = null;
    let studentSchoolId = null;
    const orgFields = mappedColumns.value.organizations;

    // First check for non-educational orgs
    if (orgFields.groups && rawStudent[orgFields.groups]) {
      const groupName = rawStudent[orgFields.groups];
      const groupId = await getOrgId('groups', groupName);
      if (groupId) {
        _set(transformedStudent, 'userData.groups', { id: groupId });
      }
    } else {
      // Process district -> school -> class hierarchy
      if (orgFields.districts && rawStudent[orgFields.districts]) {
        const districtName = rawStudent[orgFields.districts];
        studentDistrictId = await getOrgId('districts', districtName);
        console.log('Fetched district ID:', studentDistrictId);
        if (studentDistrictId) {
          _set(transformedStudent, 'userData.districts', { id: studentDistrictId });
        } else {
          console.log(`District ${districtName} not found.`);
        }
      }

      if (studentDistrictId && orgFields.schools && rawStudent[orgFields.schools]) {
        const schoolName = rawStudent[orgFields.schools];
        studentSchoolId = await getOrgId('schools', schoolName, studentDistrictId);
        console.log('Fetched school ID:', studentSchoolId);
        if (studentSchoolId) {
          _set(transformedStudent, 'userData.schools', { id: studentSchoolId });
        } else {
          console.log(`School ${schoolName} not found.`);
        }
      }

      if (studentSchoolId && orgFields.classes && rawStudent[orgFields.classes]) {
        const className = rawStudent[orgFields.classes];
        const classId = await getOrgId('classes', className, studentDistrictId, studentSchoolId);
        console.log('Fetched class ID:', classId);
        if (classId) {
          _set(transformedStudent, 'userData.classes', { id: classId });
        } else {
          console.log(`Class ${className} not found.`);
        }
      }
    }
  } else {
    // Take input from the org picker
    Object.entries(selectedOrgs.value).forEach(([key, orgs]) => {
      if (orgs.length) {
        console.log('orgs', orgs);
        _set(transformedStudent, `userData.${key}`, { id: orgs[0].id });
      }
    });
  }

  return transformedStudent;
};

const submit = async () => {
  submitting.value = SubmitStatus.TRANSFORMING;

  // Transform each student's data according to the mappings
  const transformedStudents = [];
  // const transformedStudents = rawStudentFile.value.map(transformStudentData);
  for (const student of rawStudentFile.value) {
    const tStudent = await transformStudentData(student);
    transformedStudents.push(tStudent);
  }
  submitting.value = SubmitStatus.SUBMITTING;

  console.log('Transformed students:', transformedStudents);
  const chunkedUsers = _chunk(transformedStudents, 10);
  // TODO: submit users
  for (const chunk of chunkedUsers) {
    await roarfirekit.value.createUpdateUsers(chunk).then((results) => {
      for (const result of results.data) {
        if (result?.status === 'rejected') {
          const email = result.email;
          const username = email.split('@')[0];
          console.log('Error processing user:', username, result.reason);
          // const usernameKey = getKeyByValue(dropdown_model.value, 'username');
          // const user = _find(rawStudentFile.value, (record) => {
          //   return record[usernameKey] === username;
          // });
          // addErrorUser(user, result.reason);
        } else if (result?.status === 'fulfilled') {
          const email = result.email;
          toast.add({ severity: 'success', summary: 'Success', detail: `User ${email} processed!`, life: 3000 });
        }
      }
    });
  }
  submitting.value = SubmitStatus.COMPLETE;
};

// +-----------------------------------+
// | Handle roarfirekit initialization |
// +-----------------------------------+

const refreshing = ref(false);
const initialized = ref(false);
let unsubscribe;
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  refreshing.value = false;
  initialized.value = true;
};

/**
 * Add a new empty user to the table
 */
const addUser = () => {
  if (_isEmpty(rawStudentFile.value)) return;

  // Get the structure from the first user
  const template = rawStudentFile.value[0];

  // Create a new user with all the same keys but null values
  const newUser = Object.keys(template).reduce((acc, key) => {
    if (key === 'rowKey') {
      acc[key] = rawStudentFile.value.length;
    } else {
      acc[key] = null;
    }
    return acc;
  }, {});

  // Add the new user to the array
  rawStudentFile.value.push(newUser);

  toast.add({
    severity: 'info',
    summary: 'New User Added',
    detail: 'A new empty user has been added to the table.',
    life: 3000,
  });
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.createUpdateUser) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.createUpdateUser) {
    refresh();
  }
});
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
