<template>
  <div v-if="localUserType === 'student'" class="form-container">
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">First Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.name.first ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.first" />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Middle Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.name.middle ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.middle" />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Last Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.name.last ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.last" />
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >Date of Birth
          <span v-if="localUserType === 'student'" v-tooltip.top="'Required'" class="required">*</span></label
        >
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userDobString }}</div>
        <PvDatePicker
          v-else
          v-model="localUserData.studentData.dob"
          :class="{ 'p-invalid': dobError }"
          date-format="mm/dd/yy"
          show-icon
        />
        <small v-if="dobError" class="p-error">Date of Birth cannot be in the future.</small>
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >Grade <span v-if="localUserType === 'student'" v-tooltip.top="'Required'" class="required">*</span></label
        >
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.studentData.grade ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.studentData.grade" :class="{ 'p-invalid': gradeError }" />
        <small v-if="gradeError" class="p-error">Grade must be a number 1-13, or K/PK/TK</small>
      </div>
    </div>
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Gender</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.studentData.gender ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.studentData.gender" />
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">English as a Second Language</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ localUserData.studentData.ell_status === null ? 'None' : localUserData.studentData.ell_status ? 'Yes' : 'No' }}
        </div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.ell_status"
          option-label="label"
          option-value="value"
          :options="ternaryDropdownOptions"
          placeholder="Select Status"
        />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">IEP Status</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ localUserData.studentData.iep_status === null ? 'None' : localUserData.studentData.iep_status ? 'Yes' : 'No' }}
        </div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.iep_status"
          option-label="label"
          option-value="value"
          :options="ternaryDropdownOptions"
          placeholder="Select Status"
        />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Free-Reduced Lunch</label>
         <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ localUserData.studentData.frl_status === null ? 'None' : localUserData.studentData.frl_status ? 'Yes' : 'No' }}
        </div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.frl_status"
          option-label="label"
          option-value="value"
          :options="ternaryDropdownOptions"
          placeholder="Select Status"
        />
      </div>

      <div class="form-field">
        <label for="race" :class="{ 'font-light uppercase text-sm': !editMode }">Race </label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ localUserData.studentData.race?.join(', ') || 'None' }}
        </div>
        <PvAutoComplete
          v-else
          v-model="localUserData.studentData.race"
          multiple
          :suggestions="raceOptions"
          name="race"
          @complete="searchRaces"
        />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Hispanic or Latino Ethnicity</label>
         <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ localUserData.studentData.hispanic_ethnicity === null ? 'None' : localUserData.studentData.hispanic_ethnicity ? 'Yes' : 'No' }}
        </div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.hispanic_ethnicity"
          option-label="label"
          option-value="value"
          :options="ternaryDropdownOptions"
          placeholder="Select Status"
        />
      </div>
    </div>
  </div>
  <div v-else-if="localUserType === 'admin'" class="form-container">
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">First Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.name.first ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.first" />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Middle Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.name.middle ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.middle" />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Last Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.name.last ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.last" />
      </div>
    </div>
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">
          Date of Birth
          <span v-if="editMode" class="optional">(optional)</span>
        </label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ userDobString }}
        </div>
        <PvDatePicker
          v-else
          v-model="localUserData.studentData.dob"
          :class="{ 'p-invalid': dobError }"
          date-format="mm/dd/yy"
          show-icon
        />
        <small v-if="dobError" class="p-error">Date of Birth cannot be in the future.</small>
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">
          Gender <span v-if="editMode" class="optional">(optional)</span>
        </label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.studentData.gender ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.studentData.gender" />
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">
          English as a Second Language <span v-if="editMode" class="optional">(optional)</span>
        </label>
         <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ localUserData.studentData.ell_status === null ? 'None' : localUserData.studentData.ell_status ? 'Yes' : 'No' }}
        </div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.ell_status"
          option-label="label"
          option-value="value"
          :options="ternaryDropdownOptions"
          placeholder="Select Status"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { watch, ref, onMounted, computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';
import PvAutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import PvDatePicker from 'primevue/datepicker';
import PvCheckbox from 'primevue/checkbox';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
// Keep as any for now, replace with actual type later
// import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { useNow, useDateFormat } from '@vueuse/core';

// --- Interfaces ---

interface Name {
  first: string | null;
  middle: string | null;
  last: string | null;
}

interface StudentData {
  dob: Date | null;
  grade: string | null;
  gender: string | null;
  ell_status: boolean | null;
  iep_status: boolean | null;
  frl_status: boolean | null;
  race: string[] | null;
  hispanic_ethnicity: boolean | null;
}

interface UserData {
  id?: string;
  name: Name;
  studentData: StudentData;
  testData?: boolean;
  demoData?: boolean;
  type?: 'student' | 'admin';
  dataInitialized?: boolean;
}

type UserType = 'student' | 'admin';

interface DropdownOption<T> {
  label: string;
  value: T;
}

interface Props {
  userData: UserData | null;
  userType?: UserType;
  editMode?: boolean;
}

interface Emits {
  (e: 'modalClosed'): void;
  (e: 'update:userData', payload: UserData): void;
  (e: 'validationError', error: boolean): void;
}

// --- Props and Emits ---

const props = withDefaults(defineProps<Props>(), {
  userType: 'student',
  editMode: false,
  userData: null,
});

const emit = defineEmits<Emits>();

// --- Store and State ---

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const localUserData: Ref<UserData> = ref(initializeLocalUserData(props.userType));
const localUserType: Ref<UserType> = ref(props.userType);
const gradeError = ref(false);
const dobError = ref(false);
const dataInitialized = ref(false);

const raceOptions: Ref<string[]> = ref([]);
const ternaryDropdownOptions: DropdownOption<boolean | null>[] = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
  { label: 'Unknown', value: null },
];

// const { isSuperAdmin }: { isSuperAdmin: Ref<boolean> } = (useUserClaimsQuery as any)();

// --- Computed Properties ---

const userDobString: ComputedRef<string> = computed(() => {
  const dobSource = props.editMode ? localUserData.value.studentData.dob : props.userData?.studentData?.dob;

  if (!dobSource) return 'None';

  if (dobSource instanceof Date) {
    return !isNaN(dobSource.getTime()) ? useDateFormat(dobSource, 'MM/DD/YYYY').value : 'Invalid Date';
  }

  if (typeof dobSource === 'string') {
    try {
      const date = new Date(dobSource);
      return !isNaN(date.getTime()) ? useDateFormat(date, 'MM/DD/YYYY').value : 'Invalid Date';
    } catch {
      return 'Invalid Date';
    }
  }

  return 'Invalid Date';
});

// --- Functions ---

function initializeLocalUserData(userType: UserType): UserData {
  return {
    id: undefined,
    name: { first: null, middle: null, last: null },
    studentData: {
      dob: null,
      grade: null,
      gender: null,
      ell_status: null,
      iep_status: null,
      frl_status: null,
      race: [],
      hispanic_ethnicity: null,
    },
    testData: false,
    demoData: false,
    type: userType,
  };
}

function parseDate(dateInput: Date | string | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return !isNaN(dateInput.getTime()) ? dateInput : null;
  }
  if (typeof dateInput === 'string') {
    try {
      const date = new Date(dateInput);
      return !isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

function setupUserData(sourceData: UserData | null): void {
  if (sourceData) {
    const clonedData = _cloneDeep(sourceData);
    localUserData.value = {
      id: clonedData.id,
      name: {
        first: clonedData.name?.first ?? null,
        middle: clonedData.name?.middle ?? null,
        last: clonedData.name?.last ?? null,
      },
      studentData: {
        dob: parseDate(clonedData.studentData?.dob),
        grade: clonedData.studentData?.grade ?? null,
        gender: clonedData.studentData?.gender ?? null,
        ell_status: clonedData.studentData?.ell_status ?? null,
        iep_status: clonedData.studentData?.iep_status ?? null,
        frl_status: clonedData.studentData?.frl_status ?? null,
        race: Array.isArray(clonedData.studentData?.race) ? clonedData.studentData.race : [],
        hispanic_ethnicity: clonedData.studentData?.hispanic_ethnicity ?? null,
      },
      testData: clonedData.testData ?? false,
      demoData: clonedData.demoData ?? false,
      type: clonedData.type ?? props.userType,
    };
  } else {
    localUserData.value = initializeLocalUserData(props.userType);
  }
  dataInitialized.value = true;
  validateAndEmit();
}

function searchRaces(event: AutoCompleteCompleteEvent): void {
  const allRaces = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Native Hawaiian or Other Pacific Islander',
    'White',
    'Other',
    'Prefer not to answer',
  ];
  const queryLower = event.query?.toLowerCase() ?? '';
  raceOptions.value = allRaces.filter((race) => race.toLowerCase().includes(queryLower));
}

function validateGrade(grade: string | null | undefined): boolean {
  if (!grade && localUserType.value !== 'student') return true;
  if (!grade) return false;

  const gradeLower = grade.trim().toLowerCase();
  const validNumeric = /^(?:[1-9]|1[0-3])$/.test(gradeLower);
  const validLetter = ['pk', 'tk', 'k'].includes(gradeLower);
  return validNumeric || validLetter;
}

function validateDob(dob: Date | null | undefined): boolean {
  if (!dob && localUserType.value !== 'student') return true;
  if (!dob) return false;

  if (!(dob instanceof Date) || isNaN(dob.getTime())) {
    return false;
  }
  return dob <= useNow().value;
}

function validateAndEmit(): void {
  gradeError.value = !validateGrade(localUserData.value.studentData.grade);
  dobError.value = !validateDob(localUserData.value.studentData.dob);

  const hasError = gradeError.value || dobError.value;
  emit('validationError', hasError);

  if (props.editMode && !hasError) {
    const dataToEmit = _cloneDeep(localUserData.value);
    emit('update:userData', dataToEmit);
  }
}

// --- Watchers ---

watch(
  () => props.userData,
  (newUserData, oldUserData) => {
    if (
      newUserData &&
      (!dataInitialized.value || newUserData.id !== oldUserData?.id)
    ) {
       console.log('props.userData changed, re-initializing local data. New ID:', newUserData.id, 'Old ID:', oldUserData?.id);
      dataInitialized.value = false;
      setupUserData(newUserData);
    } else if (!newUserData && dataInitialized.value) {
      console.log('props.userData became null, resetting local data.');
      dataInitialized.value = false;
      localUserData.value = initializeLocalUserData(props.userType);
      validateAndEmit();
    }
  },
  { deep: true, immediate: true }
);

watch(
  localUserData,
  (newData, oldData) => {
    if (dataInitialized.value && newData !== oldData) {
        console.log('localUserData changed, validating and potentially emitting.');
        validateAndEmit();
    }
  },
  { deep: true }
);

watch(
  () => props.userType,
  (newUserType) => {
    console.log('props.userType changed:', newUserType);
    localUserType.value = newUserType;
     if (dataInitialized.value) {
        localUserData.value.type = newUserType;
        validateAndEmit();
     }
  }
);

watch(
  () => props.editMode,
  (newEditMode) => {
    if (newEditMode && dataInitialized.value) {
        console.log('Entering edit mode, performing initial validation.');
        validateAndEmit();
    } else if (!newEditMode) {
       gradeError.value = false;
       dobError.value = false;
       emit('validationError', false);
    }
  }
);

// --- Lifecycle Hooks ---

onMounted(() => {
  console.log("EditUsersForm mounted. Initial props:", props);
});
</script>
<style lang="scss">
.form-container {
  display: flex;
  flex-direction: row;
  gap: 2rem;
  width: 100%;
  padding: 1rem;
}
.form-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
  min-width: 0;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-weight: 500;
  }

  .p-inputtext,
  .p-datepicker,
  .p-select,
  .p-autocomplete {
     width: 100%;
  }

   .p-error {
    font-size: 0.875rem;
  }

  small {
    margin-top: 0.25rem;
  }
}

.required {
  color: var(--p-red-500);
  font-weight: bold;
  margin-left: 0.25rem;
}
.admin-only {
  color: var(--p-blue-500);
  font-weight: bold;
   margin-left: 0.25rem;
}
.optional {
  color: var(--p-text-muted);
  font-style: italic;
  font-weight: normal;
   margin-left: 0.25rem;
  user-select: none;
}

div > label {
  vertical-align: middle;
}
</style>
