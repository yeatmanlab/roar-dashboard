<template>
  <div v-if="localUserType === 'student'" class="form-container">
    <div class="form-column">

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >Date of Birth
          <span v-if="localUserType === 'student'" v-tooltip.top="'Required'" class="required">*</span></label
        >
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userDobString }}</div>
        <PvDatePicker
          v-else
          v-model="localUserData.studentData.dob"
          :class="{ 'p-invalid': errorMessage.includes('Date of birth') }"
        />
        <small v-if="errorMessage.includes('Date of birth')" class="p-error"
          >Date of Birth can not be in the future.</small
        >
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >Grade <span v-if="localUserType === 'student'" v-tooltip.top="'Required'" class="required">*</span></label
        >
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.grade ?? 'None' }}</div>
        <PvInputText
          v-else
          v-model="localUserData.studentData.grade"
          :class="{ 'p-invalid': errorMessage.includes('Grade') }"
        />
        <small v-if="errorMessage.includes('Grade')" class="p-error">Grade must be a number 1-13, or K/PK/TK</small>
      </div>
      <div v-if="isSuperAdmin">
        <div>
          <PvCheckbox v-model="localUserData.testData" binary />
          <label class="ml-2">Test Data? <span v-tooltip.top="'Super Admin Only'" class="admin-only">*</span></label>
        </div>
        <div>
          <PvCheckbox v-model="localUserData.demoData" binary />
          <label class="ml-2">Demo Data? <span v-tooltip.top="'Super Admin Only'" class="admin-only">*</span></label>
        </div>
      </div>
    </div>
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Gender</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.gender ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.studentData.gender" />
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">English as a Second Language</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.ell_status ?? false }}</div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.ell_status"
          option-label="label"
          option-value="value"
          :options="binaryDropdownOptions"
        />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">IEP Status</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.iep_status ?? false }}</div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.iep_status"
          option-label="label"
          option-value="value"
          :options="binaryDropdownOptions"
        />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Free-Reduced Lunch</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.frl_status ?? false }}</div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.frl_status"
          option-label="label"
          option-value="value"
          :options="binaryDropdownOptions"
        />
      </div>

      <div class="form-field">
        <label for="race" :class="{ 'font-light uppercase text-sm': !editMode }">Race </label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ userData?.studentData?.race?.join(', ') ?? 'None' }}
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
          {{ userData?.studentData?.hispanic_ethnicity ?? false }}
        </div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.hispanic_ethnicity"
          option-label="label"
          option-value="value"
          :options="binaryDropdownOptions"
        />
      </div>
    </div>
  </div>
  <div v-else-if="localUserType === 'admin'" class="form-container">
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">First Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.name?.first ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.first" />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Middle Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.name?.middle ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.middle" />
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Last Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.name?.last ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.name.last" />
      </div>

      <div v-if="isSuperAdmin">
        <div>
          <PvCheckbox v-if="editMode" v-model="localUserData.testData" binary class="mr-2" />
          <label :class="{ 'font-light uppercase text-sm': !editMode }"
            >Test Data? <span v-tooltip.top="'Super Admin Only'" class="admin-only">*</span></label
          >
          <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.testData ? 'Yes' : 'No' }}</div>
        </div>
        <div>
          <PvCheckbox v-if="editMode" v-model="localUserData.demoData" binary class="mr-2" />
          <label :class="{ 'font-light uppercase text-sm': !editMode }"
            >Demo Data? <span v-tooltip.top="'Super Admin Only'" class="admin-only">*</span></label
          >
          <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ localUserData.demoData ? 'Yes' : 'No' }}</div>
        </div>
      </div>
    </div>
    <div class="form-column">
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >Date of Birth
          <span v-if="editMode" class="optional">(optional)</span>
        </label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">
          {{ userDobString }}
        </div>
        <PvDatePicker
          v-else
          v-model="localUserData.studentData.dob"
          :class="{ 'p-invalid': errorMessage.includes('Date of birth') }"
        />
        <small v-if="errorMessage.includes('Date of birth')" class="p-error"
          >Date of Birth can not be in the future.</small
        >
      </div>
      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >Gender <span v-if="editMode" class="optional">(optional)</span></label
        >
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.gender ?? 'None' }}</div>
        <PvInputText v-else v-model="localUserData.studentData.gender" />
      </div>

      <div class="form-field">
        <label :class="{ 'font-light uppercase text-sm': !editMode }"
          >English as a Second Language <span v-if="editMode" class="optional">(optional)</span></label
        >
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ userData?.studentData?.ell_status ?? false }}</div>
        <PvSelect
          v-else
          v-model="localUserData.studentData.ell_status"
          option-label="label"
          option-value="value"
          :options="binaryDropdownOptions"
        />
      </div>
    </div>
  </div>
</template>
<script setup>
import { watch, ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import _get from 'lodash/get';
import PvAutoComplete from 'primevue/autocomplete';
import PvDatePicker from 'primevue/datepicker';
import PvCheckbox from 'primevue/checkbox';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

const props = defineProps({
  userData: {
    type: Object,
    required: true,
  },
  userType: {
    type: String,
    default: 'student',
  },
  editMode: {
    type: Boolean,
    default: false,
  },
});

// Handle modal opening / closing
const emit = defineEmits(['modalClosed', 'update:userData']);

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);

watch(
  () => props.userData,
  (userData) => {
    // Set up localUserData object if it has not been initialized
    if (!_isEmpty(userData) && _get(localUserData, 'dataInitialized', false) === false) {
      setupUserData();
    }
  },
);

// Utility functions
const localUserData = ref({
  name: {
    first: null,
    middle: null,
    last: null,
  },
  studentData: {
    dob: null,
    grade: '',
    gender: '',
    race: [],
    hispanic_ethnicity: false,
    ell_status: false,
    frl_status: false,
    iep_status: false,
  },
  testData: false,
  demoData: false,
  dataInitialized: false,
});
const errorMessage = ref('');

// Create a local version of the userData to perform updates on
const setupUserData = () => {
  let user = {
    name: {
      first: props.userData?.name?.first || null,
      middle: props.userData?.name?.middle || null,
      last: props.userData?.name?.last || null,
    },
    studentData: {
      dob: !isNaN(new Date(props.userData?.studentData?.dob)) ? new Date(props.userData?.studentData?.dob) : null,
      grade: props.userData?.studentData?.grade || '',
      gender: props.userData?.studentData?.gender || '',
      race: props.userData?.studentData?.race || [],
      hispanic_ethnicity: props.userData?.studentData?.hispanic_ethnicity || false,
      ell_status: props.userData?.studentData?.ell_status || false,
      frl_status: props.userData?.studentData?.frl_status || false,
      iep_status: props.userData?.studentData?.iep_status || false,
    },
    testData: props.userData?.testData || false,
    demoData: props.userData?.demoData || false,
    userType: localUserType.value,
    dataInitialized: true,
  };
  localUserData.value = user;
};

// Keep track of the user's type
const localUserType = computed(() => {
  if (props.userData?.userType) return props.userData.userType;
  if (props.userType) return props.userType;
  return null;
});

const userDobString = computed(() => {
  if (localUserData.value?.studentData?.dob instanceof Date) {
    return localUserData.value?.studentData?.dob.toDateString('MM/DD/YYYY');
  } else return 'None';
});

const races = [
  'american Indian or alaska Native',
  'asian',
  'black or african American',
  'native hawaiian or other pacific islander',
  'white',
];

const raceOptions = ref([...races]);
const binaryDropdownOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const searchRaces = (event) => {
  const query = event.query.toLowerCase();

  let filteredOptions = races.filter((opt) => opt.toLowerCase().includes(query));

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }

  raceOptions.value = filteredOptions;
};

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit?.restConfig) init();
});

onMounted(() => {
  console.log('onMounted hook called');
  if (roarfirekit.value?.restConfig) init();
  if (props.userData) setupUserData();
});

// Automatically emit events when the local userData changes
// TODO: This functionality is a substitute for the v-model directive in Vue.js
//   this can be replaced when we update to Vue 3.3+
watch(
  () => localUserData.value,
  (userData) => {
    emit('update:userData', userData);
  },
  { deep: true, immediate: false },
);

// Determine if the user is an admin
const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const isSuperAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  return false;
});
</script>
<style lang="scss">
.form-container {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  width: 100%;
}
.form-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.form-field {
  display: flex;
  flex-direction: column;
}
.modal-header {
  margin-right: auto;
  display: flex;
  flex-direction: row;
}
.modal-icon {
  font-size: 1.6rem;
  margin-top: 6px;
}
.modal-title {
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.required {
  color: var(--bright-red);
}
.admin-only {
  color: var(--blue-600);
}
.optional {
  color: var(--gray-500);
  font-style: italic;
  user-select: none;
}
.modal-footer {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  width: 100%;
  gap: 1rem;
  padding: 1.5rem;
  background-color: #e6e7eb;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
}
.p-dialog .p-dialog-footer {
  padding: 0;
}
</style>
