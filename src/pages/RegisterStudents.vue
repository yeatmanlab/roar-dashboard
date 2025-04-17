<template>
  <div class="page-container">
    <div>
      <h2>Register Students</h2>
    </div>
    <Stepper linear value="1" class="w-full">
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
          <div v-if="!_isEmpty(rawStudentFile)" class="flex py-3 justify-between">
            <Button v-if="!_isEmpty(rawStudentFile)" label="Upload a different File" @click="resetUpload()" />
            <Button
              label="Next"
              :disabled="!readyToProgress('2')"
              icon="pi pi-arrow-right"
              @click="activateCallback('2')"
            />
          </div>
          <div class="step-container">
            <div class="w-full">
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
              icon-pos="right"
              @click="activateCallback('3')"
            />
          </div>
          <div class="step-container">
            <div class="flex flex-column gap-3 p-4 w-full">
              <div class="flex align-items-center">
                <label class="mr-2">Use Email</label>
                <PvToggleSwitch v-model="usingEmail" />
              </div>
              <div v-if="usingEmail" class="step-field-item">
                <div>
                  <span class="font-bold">Email<span class="text-red-500">*</span></span>
                  <p class="text-gray-500">The student's email address</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.email"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
              <div v-else class="step-field-item">
                <div>
                  <span class="font-bold">Username<span class="text-red-500">*</span></span>
                  <p class="text-gray-500">The student's username</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.username"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
              <div class="step-field-item">
                <div>
                  <span class="font-bold">Password<span class="text-red-500">*</span></span>
                  <p class="text-gray-500">The student's password</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.password"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
              <div class="step-field-item">
                <div>
                  <span class="font-bold">Date of Birth<span class="text-red-500">*</span></span>
                  <p class="text-gray-500">The student's date of birth</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.dob"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
              <div class="step-field-item">
                <div>
                  <span class="font-bold">Grade<span class="text-red-500">*</span></span>
                  <p class="text-gray-500">The student's grade</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.grade"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Names Fields -->
        <StepPanel v-slot="{ activateCallback }" value="3">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('2')" />
            <h2 class="step-header">Names</h2>
            <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" @click="activateCallback('4')" />
          </div>
          <div class="step-container">
            <div class="flex flex-column gap-3 p-4 w-full">
              <div v-for="(value, key) in nameFields" :key="key" class="step-field-item">
                <div>
                  <span class="font-bold"> {{ value.label }}</span>
                  <p class="text-gray-500">{{ value.description }}</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.names[value.field]"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Demographic Fields -->
        <StepPanel v-slot="{ activateCallback }" value="4">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('3')" />
            <h2 class="step-header">Demographics Fields</h2>
            <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" @click="activateCallback('5')" />
          </div>
          <div class="step-container" style="max-height: calc(100vh - 375px)">
            <ScrollPanel
              class="w-full"
              :dt="{
                bar: {
                  background: '{primary.color}',
                },
              }"
            >
              <div class="flex flex-column gap-3 p-4 w-full">
                <div v-for="(value, key) in demographicFields" :key="key" class="step-field-item">
                  <div>
                    <span class="font-bold"> {{ value.label }}</span>
                    <p class="text-gray-500">{{ value.description }}</p>
                  </div>
                  <Dropdown
                    v-model="mappedColumns.demographics[value.field]"
                    show-clear
                    class="w-full dropdown"
                    :options="csv_columns"
                  />
                </div>
              </div>
            </ScrollPanel>
          </div>
        </StepPanel>
        <!-- Optional Fields -->
        <StepPanel v-slot="{ activateCallback }" value="5">
          <div class="flex py-3 justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('4')" />
            <h2 class="step-header">Optional Fields</h2>
            <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" @click="activateCallback('6')" />
          </div>
          <div class="step-container">
            <div class="flex flex-column gap-3 p-4 w-full">
              <div v-for="(value, key) in optionalFields" :key="key" class="step-field-item">
                <div>
                  <span class="font-bold"> {{ value.label }}</span>
                  <p class="text-gray-500">{{ value.description }}</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.optional[value.field]"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                />
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Organizations -->
        <StepPanel v-slot="{ activateCallback }" value="6">
          <div class="py-3 flex justify-between">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('5')" />
            <h2 class="step-header">
              Organizations<i
                v-tooltip.top="
                  'Students are required to meet ONE of the following criteria: \n\n- Enrolled in at least one district, school, and class\n- Enrolled in at least one group'
                "
                class="pi pi-info-circle ml-2"
              />
            </h2>
            <Button
              :disabled="!readyToProgress('7')"
              label="Next"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="activateCallback('7')"
            />
          </div>
          <div class="step-container">
            <div class="flex flex-column gap-3 w-full">
              <div class="flex align-items-center">
                <label class="mr-2">Enroll all students to same organizations</label>
                <PvToggleSwitch v-model="usingOrgPicker" binary />
              </div>
              <div v-if="usingOrgPicker">
                <OrgPicker @selection="orgSelection($event)" />
              </div>
              <div v-else>
                <div class="flex flex-column gap-3 p-4">
                  <div v-for="(value, key) in mappedColumns.organizations" :key="key" class="step-field-item">
                    <div>
                      <span class="font-bold"> {{ _startCase(key) }}</span>
                    </div>
                    <Dropdown
                      v-model="mappedColumns.organizations[key]"
                      show-clear
                      class="w-full dropdown"
                      :options="csv_columns"
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
            <div class="flex flex-row w-full gap-2">
              <div class="flex-flex-column w-full">
                <!-- Required Fields -->
                <div class="review-section-container mb-2">
                  <div class="flex flex-row justify-between mb-2">
                    <h3 class="step-header">Required Fields</h3>
                    <Button label="Edit" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('2')" />
                  </div>
                  <div class="flex flex-row justify-between">
                    <span>ROAR Fields</span>
                    <span>Your CSV Fields</span>
                  </div>
                  <div v-for="(value, key) in mappedColumns.required" :key="key" class="review-section-item">
                    <span>{{ _startCase(key) }}</span>
                    <span class="text-gray-500">{{ value ?? '--' }}</span>
                  </div>
                </div>
                <!-- Demographic Fields -->
                <div class="review-section-container mb-2">
                  <div class="flex flex-row justify-between mb-2">
                    <h3 class="step-header">Demographic Fields</h3>
                    <Button label="Edit" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('4')" />
                  </div>
                  <div class="flex flex-row justify-between">
                    <span>ROAR Fields</span>
                    <span>Your CSV Fields</span>
                  </div>
                  <div v-for="(value, key) in mappedColumns.demographics" :key="key" class="review-section-item">
                    <span>{{ _startCase(key) }}</span>
                    <span class="text-gray-500">{{ value ?? '--' }}</span>
                  </div>
                </div>
              </div>
              <div class="flex-flex-column w-full">
                <!-- Names Fields -->
                <div class="review-section-container mb-2">
                  <div class="flex flex-row justify-between mb-2">
                    <h3 class="step-header">Names Fields</h3>
                    <Button label="Edit" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('3')" />
                  </div>
                  <div class="flex flex-row justify-between">
                    <span>ROAR Fields</span>
                    <span>Your CSV Fields</span>
                  </div>
                  <div v-for="(value, key) in mappedColumns.names" :key="key" class="review-section-item">
                    <span>{{ _startCase(key) }}</span>
                    <span class="text-gray-500">{{ value ?? '--' }}</span>
                  </div>
                </div>
                <!-- Organizations Fields -->
                <div class="review-section-container mb-2">
                  <div class="flex flex-row justify-between mb-2">
                    <h3 class="step-header">Organizations Fields</h3>
                    <Button label="Edit" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('6')" />
                  </div>
                  <div class="flex flex-row justify-between">
                    <span>ROAR Fields</span>
                    <span>{{ usingOrgPicker ? 'Selected Organizations' : 'Your CSV Fields' }}</span>
                  </div>
                  <div v-if="usingOrgPicker">
                    <div v-for="(value, key) in selectedOrgs" :key="key" class="review-section-item">
                      <span>{{ _startCase(key) }}</span>
                      <span class="text-gray-500">{{ value.map((org) => org.name).join(', ') ?? '--' }}</span>
                    </div>
                  </div>
                  <div v-else>
                    <div v-for="(value, key) in mappedColumns.organizations" :key="key" class="review-section-item">
                      <span class="mr-2">{{ _startCase(key) }}</span>
                      <span class="text-gray-500 pl-2">{{ value ?? '--' }}</span>
                    </div>
                  </div>
                </div>
                <!-- Optional Fields -->
                <div class="review-section-container mb-2">
                  <div class="flex flex-row justify-between mb-2">
                    <h3 class="step-header">Optional Fields</h3>
                    <Button label="Edit" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('5')" />
                  </div>
                  <div class="flex flex-row justify-between">
                    <span>ROAR Fields</span>
                    <span>Your CSV Fields</span>
                  </div>
                  <div v-for="(value, key) in mappedColumns.optional" :key="key" class="review-section-item">
                    <span>{{ _startCase(key) }}</span>
                    <span class="text-gray-500">{{ value ?? '--' }}</span>
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
              v-tooltip.left="!allStudentsValid ? 'Please fix validation errors before submitting' : ''"
              label="Submit"
              severity="primary"
              icon="pi pi-check"
              :disabled="!allStudentsValid"
              @click="submit()"
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
              :usingOrgPicker="usingOrgPicker"
              @validation-update="handleValidationUpdate"
            >
              <Button label="Add User" icon="pi pi-plus" severity="secondary" @click="addUser" />
            </SubmitTable>
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
import StepPanels from 'primevue/steppanels';
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
import ScrollPanel from 'primevue/scrollpanel';
const rawStudentFile = ref([]);
const tableColumns = ref([]);
const csv_columns = ref([]);
const usingEmail = ref(false);
const usingOrgPicker = ref(true);
const isFileUploaded = ref(false);
const showSubmitTable = ref(false);
const allStudentsValid = ref(false);

const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const SubmitStatus = {
  IDLE: 'idle',
  TRANSFORMING: 'transforming',
  SUBMITTING: 'submitting',
  COMPLETE: 'complete',
};
const submitting = ref(SubmitStatus.IDLE);

const nameFields = ref([
  { field: 'first', label: 'First Name', description: "The student's first name" },
  { field: 'middle', label: 'Middle Name', description: "The student's middle name" },
  { field: 'last', label: 'Last Name', description: "The student's last name" },
]);
const demographicFields = ref([
  { field: 'gender', label: 'Gender', description: "The student's gender" },
  { field: 'race', label: 'Race', description: "The student's race(s)" },
  {
    field: 'ellStatus',
    label: 'English Language Learner Status',
    description: "The student's English Language Learner status",
  },
  { field: 'frlStatus', label: 'Free-Reduced Lunch Status', description: "The student's Free-Reduced Lunch status" },
  { field: 'iepStatus', label: 'IEP Status', description: "The student's IEP status" },
  { field: 'hispanicEthnicity', label: 'Hispanic Ethinicity', description: "The student's Hispanic ethnicity" },
  { field: 'homeLanguage', label: 'Home Language', description: "The student's home language" },
]);
const optionalFields = ref([
  { field: 'testData', label: 'Test Data', description: 'Is this student a test user?' },
  { field: 'unenroll', label: 'Unenroll', description: 'Should this student be unenrolled?' },
  { field: 'stateId', label: 'State ID', description: "The student's state ID" },
  { field: 'pid', label: 'PID', description: "The student's PID" },
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
      header: col,
      dataType: dataType,
    });
  });
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
  tableColumns.value = generateColumns(rawStudentFile.value[0]);
  csv_columns.value = _remove(Object.keys(toRaw(rawStudentFile.value[0])), (col) => col !== 'rowKey');
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

/**
 * Checks if the user has filled out the information required to proceed to the targetStep.
 * @param {string} targetStep - The step to check.
 * @returns {boolean} True if the user has filled out the information required to proceed to the targetStep, false otherwise.
 */
const readyToProgress = (targetStep) => {
  // Step 1: Check if a file has been uploaded
  if (targetStep === '2') return !_isEmpty(rawStudentFile.value);

  // Step 2: check if the required columns have been mapped
  if (targetStep === '3') {
    return (
      (mappedColumns.value.required.username || mappedColumns.value.required.email) &&
      mappedColumns.value.required.password &&
      mappedColumns.value.required.dob &&
      mappedColumns.value.required.grade
    );
  }

  // Step 6: check that organization requirements have been met
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
    // are fetched in order. First district, then school, then class. If any of these are not
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
        if (studentDistrictId) {
          _set(transformedStudent, 'userData.districts', { id: studentDistrictId });
        } else {
          // TODO: display this gracefully on the UI.
          console.log(`District ${districtName} not found.`);
        }
      }

      if (studentDistrictId && orgFields.schools && rawStudent[orgFields.schools]) {
        const schoolName = rawStudent[orgFields.schools];
        studentSchoolId = await getOrgId('schools', schoolName, studentDistrictId);
        if (studentSchoolId) {
          _set(transformedStudent, 'userData.schools', { id: studentSchoolId });
        } else {
          // TODO: display this gracefully on the UI.
          console.log(`School ${schoolName} not found.`);
        }
      }

      if (studentSchoolId && orgFields.classes && rawStudent[orgFields.classes]) {
        const className = rawStudent[orgFields.classes];
        const classId = await getOrgId('classes', className, studentDistrictId, studentSchoolId);
        if (classId) {
          _set(transformedStudent, 'userData.classes', { id: classId });
        } else {
          // TODO: display this gracefully on the UI.
          console.log(`Class ${className} not found.`);
        }
      }
    }
  } else {
    // Take input from the org picker
    Object.entries(selectedOrgs.value).forEach(([key, orgs]) => {
      if (orgs.length) {
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
  for (const student of rawStudentFile.value) {
    const transformedStudent = await transformStudentData(student);
    transformedStudents.push(transformedStudent);
  }
  submitting.value = SubmitStatus.SUBMITTING;

  // Chunk users into chunks of 50 for submission
  const chunkedUsers = _chunk(transformedStudents, 50);
  for (const chunk of chunkedUsers) {
    await roarfirekit.value.createUpdateUsers(chunk).then((results) => {
      for (const result of results.data) {
        if (result?.status === 'rejected') {
          const email = result.email;
          toast.add({
            severity: 'error',
            summary: 'Error',
            detail: `User ${email} failed to process: ${result.reason}`,
            life: 5000,
          });
        } else if (result?.status === 'fulfilled') {
          const email = result.email;
          toast.add({ severity: 'success', summary: 'Success', detail: `User ${email} processed!`, life: 3000 });
        }
      }
    });
  }
  submitting.value = SubmitStatus.COMPLETE;
};

/**
 * Handles firekit initialization
 */
const refreshing = ref(false);
const initialized = ref(false);
let unsubscribe;
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  refreshing.value = false;
  initialized.value = true;
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
.step-field-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 0.5rem;
}

.dropdown {
  height: 2.5rem;
  width: 30rem;
  max-width: 30rem;
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
