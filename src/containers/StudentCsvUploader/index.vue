<template>
  <div>
    <Stepper linear :value="currentStep" class="w-full">
      <StepList>
        <Step :value="REGISTRATION_STEPS.UPLOAD">Upload</Step>
        <Step :value="REGISTRATION_STEPS.REQUIRED">Required</Step>
        <Step :value="REGISTRATION_STEPS.NAMES">Names</Step>
        <Step :value="REGISTRATION_STEPS.DEMOGRAPHICS">Demographics</Step>
        <Step :value="REGISTRATION_STEPS.OTHER">Other</Step>
        <Step :value="REGISTRATION_STEPS.ORGANIZATIONS">Organizations</Step>
        <Step :value="REGISTRATION_STEPS.PREVIEW">Preview</Step>
      </StepList>
      <StepPanels>
        <!-- Upload CSV -->
        <StepPanel v-slot="{ activateCallback }" :value="REGISTRATION_STEPS.UPLOAD">
          <UploadStep
            :raw-student-file="rawStudentFile"
            :table-columns="tableColumns"
            @file-upload="onFileUpload"
            @reset-upload="resetUpload"
            @activate="activateCallback"
          />
        </StepPanel>

        <!-- Required Fields -->
        <StepPanel v-slot="{ activateCallback }" :value="REGISTRATION_STEPS.REQUIRED">
          <RequiredStep
            :using-email="usingEmail"
            :mapped-columns="mappedColumns"
            :csv-columns="csv_columns"
            :ready-to-progress="readyToProgress(REGISTRATION_STEPS.NAMES)"
            @update:using-email="usingEmail = $event"
            @update:mapped-columns="updateMappedColumns"
            @activate="activateCallback"
          />
        </StepPanel>

        <!-- Names Fields -->
        <StepPanel v-slot="{ activateCallback }" :value="REGISTRATION_STEPS.NAMES">
          <NamesStep
            :name-fields="nameFields"
            :mapped-columns="mappedColumns"
            :csv-columns="csv_columns"
            @update:mapped-columns="updateMappedColumns"
            @activate="activateCallback"
          />
        </StepPanel>

        <!-- Demographic Fields -->
        <StepPanel v-slot="{ activateCallback }" :value="REGISTRATION_STEPS.DEMOGRAPHICS">
          <DemographicsStep
            :demographic-fields="demographicFields"
            :mapped-columns="mappedColumns"
            :csv-columns="csv_columns"
            @update:mapped-columns="updateMappedColumns"
            @activate="activateCallback"
          />
        </StepPanel>

        <!-- Other Fields -->
        <StepPanel v-slot="{ activateCallback }" :value="REGISTRATION_STEPS.OTHER">
          <OtherStep
            :optional-fields="optionalFields"
            :mapped-columns="mappedColumns"
            :csv-columns="csv_columns"
            :user-can="userCan"
            @update:mapped-columns="updateMappedColumns"
            @activate="activateCallback"
          />
        </StepPanel>

        <!-- Organizations -->
        <StepPanel v-slot="{ activateCallback }" :value="REGISTRATION_STEPS.ORGANIZATIONS">
          <OrganizationsStep
            :using-org-picker="usingOrgPicker"
            :mapped-columns="mappedColumns"
            :csv-columns="csv_columns"
            :edu-orgs-selected="eduOrgsSelected"
            :non-edu-orgs-selected="nonEduOrgsSelected"
            :ready-to-progress="readyToProgress(REGISTRATION_STEPS.PREVIEW)"
            @update:using-org-picker="usingOrgPicker = $event"
            @update:mapped-columns="updateMappedColumns"
            @org-selection="orgSelection"
            @activate="
              (step) => {
                activateCallback(step);
                if (step === REGISTRATION_STEPS.PREVIEW) preTransformStudents();
              }
            "
          />
        </StepPanel>

        <!-- Preview -->
        <StepPanel :value="REGISTRATION_STEPS.PREVIEW">
          <div class="flex py-3 justify-between">
            <Button
              label="Back"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="currentStep = REGISTRATION_STEPS.ORGANIZATIONS"
            />
            <h2 class="step-header">Preview</h2>
            <div></div>
          </div>
          <div class="step-container">
            <div v-if="showSubmitTable" class="w-full">
              <StudentCsvDataTable
                :students="mappedStudents"
                :mappings="mappedColumns"
                :using-org-picker="usingOrgPicker"
                :using-email="usingEmail"
                @validation-update="validationUpdate"
              >
                <Button
                  :disabled="!allValid || submitting !== SUBMIT_STATUS.IDLE"
                  :loading="submitting !== SUBMIT_STATUS.IDLE"
                  label="Submit"
                  @click="submit"
                />
              </StudentCsvDataTable>
            </div>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import Stepper from '@/components/Stepper/Stepper.vue';
import StepList from '@/components/Stepper/StepList.vue';
import Step from '@/components/Stepper/Step.vue';
import StepPanels from '@/components/Stepper/StepPanels.vue';
import StepPanel from '@/components/Stepper/StepPanel.vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import _chunk from 'lodash/chunk';
import { usePermissions } from '@/composables/usePermissions';
import { REGISTRATION_STEPS, SUBMIT_STATUS, FIELD_TYPES } from '@/constants/studentRegistration';
import { generateColumns } from '@/utils/csv-helpers.util';
import { transformStudentData } from '@/services/student.service';
import useStudentRegistrationMutation from '@/composables/mutations/useStudentRegistrationMutation';

// Import step components
import UploadStep from './components/steps/UploadStep.vue';
import RequiredStep from './components/steps/RequiredStep.vue';
import NamesStep from './components/steps/NamesStep.vue';
import DemographicsStep from './components/steps/DemographicsStep.vue';
import OtherStep from './components/steps/OtherStep.vue';
import OrganizationsStep from './components/steps/OrganizationsStep.vue';
import StudentCsvDataTable from '@/containers/StudentCsvDataTable/index.vue';

// Setup stores and composables
const toast = useToast();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const { userCan } = usePermissions();
const { mutate: registerStudents } = useStudentRegistrationMutation();

// State management
const currentStep = ref(REGISTRATION_STEPS.UPLOAD);
const rawStudentFile = ref([]);
const tableColumns = ref([]);
const csv_columns = ref([]);
const usingEmail = ref(false);
const usingOrgPicker = ref(true);
const mappedColumns = ref({
  [FIELD_TYPES.REQUIRED]: {},
  [FIELD_TYPES.NAMES]: {},
  [FIELD_TYPES.DEMOGRAPHICS]: {},
  [FIELD_TYPES.OPTIONAL]: {},
  [FIELD_TYPES.ORGANIZATIONS]: {},
});
const selectedOrgs = ref({
  districts: [],
  schools: [],
  classes: [],
  groups: [],
});
const mappedStudents = ref([]);
const showSubmitTable = ref(false);
const allValid = ref(false);
const submitting = ref(SUBMIT_STATUS.IDLE);

// Field definitions
const nameFields = {
  first: {
    label: 'First Name',
    description: "The student's first name",
    field: 'first',
  },
  middle: {
    label: 'Middle Name',
    description: "The student's middle name",
    field: 'middle',
  },
  last: {
    label: 'Last Name',
    description: "The student's last name",
    field: 'last',
  },
};

const demographicFields = {
  gender: {
    label: 'Gender',
    description: "The student's gender",
    field: 'gender',
  },
  race: {
    label: 'Race',
    description: "The student's race",
    field: 'race',
  },
  ellStatus: {
    label: 'ELL Status',
    description: 'English Language Learner Status',
    field: 'ellStatus',
  },
  frlStatus: {
    label: 'FRL Status',
    description: 'Free and Reduced Lunch Status',
    field: 'frlStatus',
  },
  iepStatus: {
    label: 'IEP Status',
    description: 'Individualized Education Program Status',
    field: 'iepStatus',
  },
};

const optionalFields = {
  notes: {
    label: 'Notes',
    description: 'Additional notes about the student',
    field: 'notes',
  },
  pid: {
    label: 'PID',
    description: 'Personal Identifier',
    field: 'pid',
  },
};

// Computed properties
const eduOrgsSelected = computed(() => {
  return selectedOrgs.value.districts.length > 0 && selectedOrgs.value.schools.length > 0;
});

const nonEduOrgsSelected = computed(() => {
  return selectedOrgs.value.groups.length > 0;
});

// Methods
function readyToProgress(step) {
  if (step === REGISTRATION_STEPS.REQUIRED) {
    return !_isEmpty(rawStudentFile.value);
  }
  if (step === REGISTRATION_STEPS.PREVIEW) {
    return eduOrgsSelected.value || nonEduOrgsSelected.value;
  }
  return true;
}

function onFileUpload(event) {
  // Implementation for file upload
  const file = event.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const csv = e.target.result;
    const lines = csv.split('\n');
    const headers = lines[0].split(',');

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      const obj = {};
      const currentLine = lines[i].split(',');

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j].trim()] = currentLine[j]?.trim() || '';
      }

      obj.rowKey = i.toString();
      result.push(obj);
    }

    rawStudentFile.value = result;
    if (result.length > 0) {
      tableColumns.value = generateColumns(result[0]);
      csv_columns.value = headers.map((header) => ({
        field: header.trim(),
        header: header.trim(),
      }));
    }

    currentStep.value = REGISTRATION_STEPS.REQUIRED;
  };

  reader.readAsText(file);
}

function resetUpload() {
  rawStudentFile.value = [];
  tableColumns.value = [];
  csv_columns.value = [];
  mappedColumns.value = {
    [FIELD_TYPES.REQUIRED]: {},
    [FIELD_TYPES.NAMES]: {},
    [FIELD_TYPES.DEMOGRAPHICS]: {},
    [FIELD_TYPES.OPTIONAL]: {},
    [FIELD_TYPES.ORGANIZATIONS]: {},
  };
  currentStep.value = REGISTRATION_STEPS.UPLOAD;
}

function updateMappedColumns(category, field, value) {
  mappedColumns.value[category][field] = value;
}

function orgSelection(orgs) {
  selectedOrgs.value = orgs;
}

function validationUpdate(isValid) {
  allValid.value = isValid;
}

function preTransformStudents() {
  // Transform students for preview
  mappedStudents.value = rawStudentFile.value.map((student) => {
    const mappedStudent = { ...student };
    mappedStudent.rowKey = student.rowKey;
    return mappedStudent;
  });

  showSubmitTable.value = true;
}

async function submit() {
  submitting.value = SUBMIT_STATUS.TRANSFORMING;

  // Transform each student's data according to the mappings
  const transformedStudents = [];
  for (const student of mappedStudents.value) {
    const transformedStudent = await transformStudentData(
      student,
      mappedColumns.value,
      usingEmail.value,
      selectedOrgs.value,
      usingOrgPicker.value,
      getOrgId,
    );
    transformedStudents.push(transformedStudent);
  }

  submitting.value = SUBMIT_STATUS.SUBMITTING;

  registerStudents(transformedStudents, {
    onSuccess: (results) => {
      for (const result of results) {
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
      submitting.value = SUBMIT_STATUS.COMPLETE;
    },
    onError: (error) => {
      console.error('Error registering students:', error);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to register students',
        life: 5000,
      });
      submitting.value = SUBMIT_STATUS.IDLE;
    },
  });
}

// Helper function to get organization ID
async function getOrgId(type, name, districtId = null, schoolId = null) {
  // Implementation for getting organization ID
  if (!name) return null;

  try {
    let result;
    switch (type) {
      case 'districts':
        result = await roarfirekit.value.getDistrictByName(name);
        return result?.id || null;
      case 'schools':
        result = await roarfirekit.value.getSchoolByName(name, districtId);
        return result?.id || null;
      case 'classes':
        result = await roarfirekit.value.getClassByName(name, schoolId);
        return result?.id || null;
      case 'groups':
        result = await roarfirekit.value.getGroupByName(name);
        return result?.id || null;
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error getting ${type} ID for ${name}:`, error);
    return null;
  }
}

// Lifecycle hooks
onMounted(async () => {
  if (roarfirekit.value.createUpdateUser) {
    // Initialize
  }
});
</script>

<style scoped>
.step-container {
  width: 100%;
  height: 100%;
  display: flex;
  padding: 0 2rem;
}
.step-header {
  margin: 0;
}
.datatable {
  border: 1px solid var(--surface-d);
  border-radius: 5px;
}
</style>
