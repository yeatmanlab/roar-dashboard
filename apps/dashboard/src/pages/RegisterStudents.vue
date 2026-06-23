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
        <Step value="5">Other</Step>
        <Step value="6">Organizations</Step>
        <Step value="7">Preview</Step>
      </StepList>
      <StepPanels>
        <!-- Upload CSV -->
        <StepPanel v-slot="{ activateCallback }" value="1">
          <div v-if="!_isEmpty(rawStudentFile)" class="flex justify-between py-3">
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
                  class="text-white border-none bg-primary border-round hover:bg-red-900"
                  custom-upload
                  accept=".csv"
                  auto
                  :show-upload-button="false"
                  :show-cancel-button="false"
                  @uploader="onFileUpload($event)"
                >
                  <template #empty>
                    <div class="ml-6 text-gray-500 extra-height">
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
          <div class="flex justify-between py-3">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('1')" />
            <h2 class="step-header">Required</h2>
            <Button
              label="Next"
              :disabled="!readyToProgress('3')"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="activateCallback('3')"
            />
          </div>
          <div class="step-container">
            <div class="flex gap-3 p-4 w-full flex-column">
              <div class="flex align-items-center">
                <label class="mr-2">Use Email</label>
                <PvToggleSwitch v-model="usingEmail" />
              </div>
              <div v-if="usingEmail" class="step-field-item">
                <div>
                  <span class="font-bold">Email<span class="text-red-500">*</span></span>
                  <p class="my-2 text-gray-500">The student's email address</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.email"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                  pt:label:data-testid="dropdown__label"
                />
              </div>
              <div v-else class="step-field-item">
                <div>
                  <span class="font-bold">Username<span class="text-red-500">*</span></span>
                  <p class="my-2 text-gray-500">The student's username</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.username"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                  pt:label:data-testid="dropdown__label"
                />
              </div>
              <div class="step-field-item">
                <div>
                  <span class="font-bold">Password<span class="text-red-500">*</span></span>
                  <p class="my-2 text-gray-500">The student's password</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.password"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                  pt:label:data-testid="dropdown__label"
                />
              </div>
              <div class="step-field-item">
                <div>
                  <span class="font-bold">Date of Birth<span class="text-red-500">*</span></span>
                  <p class="my-2 text-gray-500">The student's date of birth</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.dob"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                  pt:label:data-testid="dropdown__label"
                />
              </div>
              <div class="step-field-item">
                <div>
                  <span class="font-bold">Grade<span class="text-red-500">*</span></span>
                  <p class="my-2 text-gray-500">The student's grade</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.required.grade"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                  pt:label:data-testid="dropdown__label"
                />
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Names Fields -->
        <StepPanel v-slot="{ activateCallback }" value="3">
          <div class="flex justify-between py-3">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('2')" />
            <h2 class="step-header">Names</h2>
            <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" @click="activateCallback('4')" />
          </div>
          <div class="step-container">
            <div class="flex gap-3 p-4 w-full flex-column">
              <div v-for="(value, key) in nameFields" :key="key" class="step-field-item">
                <div>
                  <span class="font-bold"> {{ value.label }}</span>
                  <p class="my-2 text-gray-500">{{ value.description }}</p>
                </div>
                <Dropdown
                  v-model="mappedColumns.names[value.field]"
                  show-clear
                  class="w-full dropdown"
                  :options="csv_columns"
                  pt:label:data-testid="dropdown__label"
                />
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Demographic Fields -->
        <StepPanel v-slot="{ activateCallback }" value="4">
          <div class="flex justify-between py-3">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('3')" />
            <h2 class="step-header">Demographics</h2>
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
              <div class="flex gap-3 pt-2 w-full flex-column">
                <div v-for="(value, key) in demographicFields" :key="key" class="step-field-item">
                  <div>
                    <span class="font-bold"> {{ value.label }}</span>
                    <p class="my-2 text-gray-500">{{ value.description }}</p>
                  </div>
                  <MultiSelect
                    v-if="value.field === 'race'"
                    v-model="mappedColumns.demographics[value.field]"
                    :options="csv_columns"
                    show-clear
                    class="w-full dropdown"
                  />
                  <Dropdown
                    v-else
                    v-model="mappedColumns.demographics[value.field]"
                    show-clear
                    class="w-full dropdown"
                    :options="csv_columns"
                    pt:label:data-testid="dropdown__label"
                  />
                </div>
              </div>
            </ScrollPanel>
          </div>
        </StepPanel>
        <!-- Other Fields -->
        <StepPanel v-slot="{ activateCallback }" value="5">
          <div class="flex justify-between py-3">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('4')" />
            <h2 class="step-header">Other</h2>
            <Button label="Next" icon="pi pi-arrow-right" icon-pos="right" @click="activateCallback('6')" />
          </div>
          <div class="step-container">
            <div class="flex gap-3 p-4 w-full flex-column">
              <div v-for="(value, key) in optionalFields" :key="key">
                <div v-if="!value?.permission || userCan(value?.permission)" class="step-field-item">
                  <div>
                    <span class="font-bold"> {{ value.label }}</span>
                    <p class="my-2 text-gray-500">{{ value.description }}</p>
                  </div>
                  <Dropdown
                    v-model="mappedColumns.optional[value.field]"
                    show-clear
                    class="w-full dropdown"
                    :options="csv_columns"
                    pt:label:data-testid="dropdown__label"
                  />
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Organizations -->
        <StepPanel v-slot="{ activateCallback }" value="6">
          <div class="flex justify-between py-3">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('5')" />
            <h2 class="step-header">Organizations</h2>
            <Button
              :disabled="!readyToProgress('7')"
              label="Next"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="
                activateCallback('7');
                preTransformStudents();
              "
            />
          </div>
          <div class="step-container">
            <div class="flex gap-3 w-full flex-column">
              <div class="flex justify-between">
                <div class="flex gap-2 align-items-center flex-column justify-content-">
                  <SelectButton
                    v-model="usingOrgPicker"
                    :options="[
                      { label: 'Same for all students', value: true },
                      { label: 'From CSV columns', value: false },
                    ]"
                    option-label="label"
                    option-value="value"
                  />
                  <small class="text-gray-500">
                    {{
                      usingOrgPicker
                        ? 'Select organizations to assign to all students'
                        : 'Map CSV columns to organizations'
                    }}
                  </small>
                </div>
                <div>
                  <div style="margin-left: -25px">One of the following required:</div>
                  <div :class="{ 'text-green-500': eduOrgsSelected }">
                    <i v-if="eduOrgsSelected" class="mr-2 pi pi-check" style="margin-left: -25px" /><i
                      v-else
                      class="mr-2 pi pi-circle"
                      style="margin-left: -25px"
                    />At least one district and one school
                  </div>
                  <div :class="{ 'text-green-500': nonEduOrgsSelected }">
                    <i v-if="nonEduOrgsSelected" class="mr-2 pi pi-check" style="margin-left: -25px" /><i
                      v-else
                      class="mr-2 pi pi-circle"
                      style="margin-left: -25px"
                    />At least one group
                  </div>
                </div>
              </div>
              <div v-if="usingOrgPicker">
                <OrgPicker @selection="orgSelection($event)" />
              </div>
              <div v-else>
                <div class="flex gap-3 p-4 flex-column">
                  <div v-for="(value, key) in orgFields" :key="key" class="step-field-item">
                    <div>
                      <span class="font-bold"> {{ value.label }}</span>
                    </div>
                    <Dropdown
                      v-model="mappedColumns.organizations[value.field]"
                      show-clear
                      class="w-full dropdown"
                      :options="csv_columns"
                      pt:label:data-testid="dropdown__label"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StepPanel>
        <!-- Preview & Submit -->
        <StepPanel v-slot="{ activateCallback }" value="7">
          <div class="flex justify-between py-3">
            <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('6')" />
            <h2 class="step-header">Preview & Submit</h2>
            <Button
              v-tooltip.left="!allStudentsValid ? 'Please fix validation errors before submitting' : ''"
              label="Submit"
              severity="primary"
              :icon="submitting === SubmitStatus.SUBMITTING ? 'pi pi-spinner pi-spin' : 'pi pi-check'"
              :disabled="!allStudentsValid || submitting === SubmitStatus.SUBMITTING"
              @click="submit()"
            />
          </div>
          <div class="flex step-container flex-column">
            <div v-if="submitting !== SubmitStatus.IDLE">
              <div class="flex gap-3 flex-column">
                <h3 v-if="submitting === SubmitStatus.TRANSFORMING" class="step-header">
                  <i class="mr-2 pi pi-spinner pi-spin"></i>Formatting Students...
                </h3>
                <h3 v-if="submitting === SubmitStatus.SUBMITTING" class="step-header">
                  <i class="mr-2 pi pi-spinner pi-spin"></i>Submitting...
                </h3>
                <h3 v-if="submitting === SubmitStatus.COMPLETE" class="step-header">Upload Complete.</h3>
              </div>
            </div>
            <SubmitTable
              v-if="showSubmitTable"
              :students="mappedStudents"
              :mappings="mappedColumns"
              :using-org-picker="usingOrgPicker"
              :using-email="usingEmail"
              :submit-status="submitting"
              @validation-update="handleValidationUpdate"
              @delete-student="removeUser"
            >
              <Button label="Add User" icon="pi pi-plus" severity="secondary" @click="addUser" />
              <Button label="Download" icon="pi pi-download" severity="secondary" @click="exportTransformedStudents" />
            </SubmitTable>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>
<script setup>
import { ref, toRaw, onMounted, computed } from 'vue';
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
import csvRowToImportRow from '@/helpers/csvRowToImportRow';
import { getRoarApiClient } from '@/clients/roar-api';
import { StatusCodes } from 'http-status-codes';
import { orgFetchAll } from '@/helpers/query/orgs';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import OrgPicker from '@/components/OrgPicker.vue';
import PvDataTable from 'primevue/datatable';
import PvColumn from 'primevue/column';
import _forEach from 'lodash/forEach';
import _chunk from 'lodash/chunk';
import _set from 'lodash/set';
import _remove from 'lodash/remove';
import SubmitTable from '@/components/SubmitTable.vue';
import ScrollPanel from 'primevue/scrollpanel';
import SelectButton from 'primevue/selectbutton';
import MultiSelect from 'primevue/multiselect';
import { usePermissions } from '../composables/usePermissions';
import { exportCsv, orderByDefault } from '@/helpers/query/utils';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import _without from 'lodash/without';

const rawStudentFile = ref([]);
const tableColumns = ref([]);
const csv_columns = ref([]);
const usingEmail = ref(false);
const usingOrgPicker = ref(true);
const isFileUploaded = ref(false);
const showSubmitTable = ref(false);
const allStudentsValid = ref(false);

const refreshing = ref(false);
const initialized = ref(false);

const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const { userCan, Permissions } = usePermissions();

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
  {
    field: 'frlStatus',
    label: 'Free and Reduced Lunch Status',
    description: "The student's Free and Reduced Lunch status",
  },
  { field: 'iepStatus', label: 'IEP Status', description: "The student's IEP status" },
  { field: 'hispanicEthnicity', label: 'Hispanic Ethnicity', description: "The student's Hispanic ethnicity" },
  { field: 'homeLanguage', label: 'Home Language', description: "The student's home language(s)" },
]);
const optionalFields = ref([
  {
    field: 'testData',
    label: 'Test Data',
    description: 'Is this student a test user?',
    permission: Permissions.TestData.CREATE,
  },
  {
    field: 'unenroll',
    label: 'Unenroll',
    description: 'Should this student be unenrolled?',
    permission: Permissions.Users.UNENROLL,
  },
  { field: 'stateId', label: 'State ID', description: "The student's state ID" },
  { field: 'pid', label: 'PID', description: "The student's PID", permission: Permissions.Users.SET_PID },
]);
const orgFields = ref([
  { field: 'districts', label: 'District', description: '' },
  { field: 'schools', label: 'School', description: '' },
  { field: 'classes', label: 'Class', description: '' },
  { field: 'groups', label: 'Group', description: '' },
  { field: 'families', label: 'Family', description: '' },
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
  organizations: Object.fromEntries(orgFields.value.map((field) => [field.field, null])),
});
const selectedOrgs = ref({
  districts: [],
  schools: [],
  classes: [],
  groups: [],
  families: [],
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

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
  if (_isEmpty(mappedStudents.value)) return;

  // Get the structure from the first user
  const template = mappedStudents.value[0];

  // Create a new user with all the same keys but null values
  const newUser = Object.keys(template).reduce((acc, key) => {
    if (key === 'rowKey') {
      acc[key] = mappedStudents.value.length;
    } else {
      acc[key] = null;
    }
    return acc;
  }, {});

  // Add the new user to the array
  mappedStudents.value.push(newUser);

  toast.add({
    severity: 'info',
    summary: 'New User Added',
    detail: 'A new empty user has been added to the table.',
    life: 3000,
  });
};

const removeUser = (student) => {
  if (submitting.value !== SubmitStatus.IDLE) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Cannot remove user while submitting.',
      life: 3000,
    });
    return;
  } else {
    mappedStudents.value = mappedStudents.value.filter((s) => s.rowKey !== student.rowKey);
  }
};

const exportTransformedStudents = () => {
  const exportData = mappedStudents.value;
  // Filter out rowKey
  const filteredData = exportData.map((row) => {
    // eslint-disable-next-line no-unused-vars
    const { rowKey, ...rest } = row;
    return rest;
  });

  exportCsv(filteredData, 'roar-students.csv');
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
        (!_isEmpty(selectedOrgs.value.districts) && !_isEmpty(selectedOrgs.value.schools)) ||
        !_isEmpty(selectedOrgs.value.groups) ||
        !_isEmpty(selectedOrgs.value.families)
      );
    } else {
      // Check that mappedColumns.organizations has all the required fields not null
      return (
        (mappedColumns.value.organizations.districts && mappedColumns.value.organizations.schools) ||
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
    // Fetch user's available orgs of type orgType
    const userAdminOrgs = await orgFetchAll(
      orgType,
      selectedDistrict,
      selectedSchool,
      orderByDefault,
      isSuperAdmin,
      adminOrgs,
      ['id', 'name', 'districtId', 'schoolId', 'schools', 'classes'],
    );

    // Cache orgs in case we need them for a subsequent call
    userAdminOrgs.forEach((org) => {
      const cacheKey =
        orgType === 'schools'
          ? `${org.name}-${selectedDistrict}`
          : orgType === 'classes'
            ? `${org.name}-${selectedSchool}`
            : org.name;
      orgCache.value[orgType].set(cacheKey, org.id);
    });

    // Find org with name orgName
    const org = userAdminOrgs.find((o) => o.name.trim().toLowerCase() === orgName.trim().toLowerCase());
    return org?.id;
  } catch (error) {
    console.error(`Error fetching ${orgType} ID for ${orgName}:`, error);
    return null;
  }
};

const eduOrgsSelected = computed(() => {
  if (usingOrgPicker.value) {
    return !_isEmpty(selectedOrgs.value.districts) && !_isEmpty(selectedOrgs.value.schools);
  } else {
    return (
      !_isEmpty(mappedColumns.value.organizations.districts) && !_isEmpty(mappedColumns.value.organizations.schools)
    );
  }
});

const nonEduOrgsSelected = computed(() => {
  if (usingOrgPicker.value) {
    return !_isEmpty(selectedOrgs.value.groups) || !_isEmpty(selectedOrgs.value.families);
  } else {
    return !_isEmpty(mappedColumns.value.organizations.groups) || !_isEmpty(mappedColumns.value.organizations.families);
  }
});

/**
 * Submission handlers
 */
const mappedStudents = ref([]);
const preTransformStudents = () => {
  const transformedStudents = [];
  for (const rawStudent of rawStudentFile.value) {
    const transformedStudent = {};
    transformedStudent['rowKey'] = rawStudent['rowKey'];
    // Handle required fields
    Object.entries(mappedColumns.value.required).forEach(([key, csvField]) => {
      if (csvField) {
        _set(transformedStudent, key, rawStudent[csvField]);
      }
    });

    // Handle name fields
    Object.entries(mappedColumns.value.names).forEach(([key, csvField]) => {
      if (csvField) _set(transformedStudent, key, rawStudent[csvField]);
    });

    // Handle demographic fields
    Object.entries(mappedColumns.value.demographics).forEach(([key, csvField]) => {
      if (csvField) {
        // In the case of race, which is a multiselect field, we need to
        // concat the values from each field into one comma separated string
        if (key === 'race') {
          const races = _without(
            csvField.map((item) => rawStudent[item] ?? null),
            null,
          );
          _set(transformedStudent, key, races.join(', '));
        } else {
          _set(transformedStudent, key, rawStudent[csvField]);
        }
      }
    });

    // Handle optional fields
    Object.entries(mappedColumns.value.optional).forEach(([key, csvField]) => {
      if (csvField) {
        _set(transformedStudent, key, rawStudent[csvField]);
      }
    });

    if (!usingOrgPicker.value) {
      // Handle organizations
      Object.entries(mappedColumns.value.organizations).forEach(([key, csvField]) => {
        if (csvField) {
          _set(transformedStudent, key, rawStudent[csvField]);
        }
      });
    }
    transformedStudents.push(transformedStudent);
  }
  mappedStudents.value = transformedStudents;
  showSubmitTable.value = true;
};
// Maps the org-field key (plural) to the import-row membership entity type (singular).
const ORG_KEY_TO_ENTITY_TYPE = {
  districts: 'district',
  schools: 'school',
  classes: 'class',
  groups: 'group',
  families: 'family',
};

const transformStudentData = async (rawStudent) => {
  // Build the import-row shape directly from the CSV-mapped row; fill memberships below.
  const importRow = csvRowToImportRow(rawStudent);

  const addMembership = (entityType, entityId) => {
    if (entityId) {
      // Students belong to a family as a `child`; to every other entity as a `student`.
      importRow.memberships.push({ entityType, entityId, role: entityType === 'family' ? 'child' : 'student' });
    }
  };

  if (!usingOrgPicker.value) {
    // The CSV supplies org names; resolve them to IDs in district -> school -> class order. If a
    // parent is missing the dependent lookups are skipped (they need the parent to resolve).
    const orgFields = mappedColumns.value.organizations;
    let studentDistrictId = null;
    let studentSchoolId = null;

    if (orgFields.groups && rawStudent['groups']) {
      addMembership('group', await getOrgId('groups', rawStudent['groups']));
    }

    if (orgFields.districts && rawStudent['districts']) {
      studentDistrictId = await getOrgId('districts', rawStudent['districts']);
      if (studentDistrictId) addMembership('district', studentDistrictId);
      // TODO: display this gracefully on the UI.
      else console.error(`District ${rawStudent['districts']} not found.`);
    }

    if (studentDistrictId && orgFields.schools && rawStudent['schools']) {
      studentSchoolId = await getOrgId('schools', rawStudent['schools'], studentDistrictId);
      if (studentSchoolId) addMembership('school', studentSchoolId);
      else console.error(`School ${rawStudent['schools']} not found.`);
    }

    if (studentSchoolId && orgFields.classes && rawStudent['classes']) {
      const classId = await getOrgId('classes', rawStudent['classes'], studentDistrictId, studentSchoolId);
      if (classId) addMembership('class', classId);
      else console.error(`Class ${rawStudent['classes']} not found.`);
    }
  } else {
    // The org picker supplies selected org IDs directly.
    Object.keys(selectedOrgs.value).forEach((key) => {
      if (selectedOrgs.value[key].length) {
        addMembership(ORG_KEY_TO_ENTITY_TYPE[key], selectedOrgs.value[key][0].id);
      }
    });
  }

  return importRow;
};

const submit = async () => {
  submitting.value = SubmitStatus.TRANSFORMING;

  // Transform each student into an import row (memberships resolved via org-id lookups).
  const importRows = [];
  for (const student of mappedStudents.value) {
    importRows.push(await transformStudentData(student));
  }
  submitting.value = SubmitStatus.SUBMITTING;

  // Chunk under the endpoint's 100-row cap (50 keeps headroom) and submit each chunk.
  const client = getRoarApiClient();
  const chunkedUsers = _chunk(importRows, 50);
  for (const chunk of chunkedUsers) {
    const response = await client.users.bulkImport({ body: { users: chunk } });

    if (response.status !== StatusCodes.OK) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `A batch of ${chunk.length} users failed to process (status ${response.status}).`,
        life: 5000,
      });
      continue;
    }

    // The endpoint returns a per-row multi-status body; map each result back to its row's email.
    for (const rowResult of response.body.data.results) {
      const email = chunk[rowResult.index]?.email;
      if (rowResult.status === 'ok') {
        toast.add({
          severity: 'success',
          summary: 'Success',
          detail: `User ${email} ${rowResult.classification}.`,
          life: 3000,
        });
      } else {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `User ${email} failed: ${rowResult.error.message}`,
          life: 5000,
        });
      }
    }
  }
  submitting.value = SubmitStatus.COMPLETE;
};

/**
 * Handles firekit initialization
 */
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
