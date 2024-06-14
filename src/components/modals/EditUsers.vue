<template>
  <PvConfirmDialog group="headless" :close="console.log('onClose')">
    <template #container="{ message, acceptCallback, rejectCallback }">
      <div class="flex flex-column align-items-center surface-overlay border-round" style="width: 66vw; gap: 2rem">
        <!-- <p class="mb-0">{{ userData }}</p> -->
        <!-- Fields for userData form -->
        <div class="modal-header gap-2">
          <i class="pi pi-pencil text-gray-400 modal-icon"></i>
          <div class="flex flex-column">
            <h1 class="modal-title admin-page-header">
              Edit User Information - {{ localUserData.name.first }} {{ localUserData.name.last }}
            </h1>
            <span class="text-md text-gray-500">Modify, add, or remove user information</span>
          </div>
        </div>
        <div v-if="localUserType === 'student'" class="form-container">
          <div class="form-column">
            <div class="form-field">
              <label>First Name</label>
              <PvInputText v-model="localUserData.name.first" />
            </div>
            <div class="form-field">
              <label>Middle Name</label>
              <PvInputText v-model="localUserData.name.middle" />
            </div>
            <div class="form-field">
              <label>Last Name</label>
              <PvInputText v-model="localUserData.name.last" />
            </div>

            <div class="form-field">
              <label>Date of Birth <span v-if="localUserType === 'student'" class="required">*</span></label>
              <PvCalendar v-model="localUserData.studentData.dob" />
            </div>

            <div class="form-field">
              <label>Grade <span v-if="localUserType === 'student'" class="required">*</span></label>
              <PvInputText v-model="localUserData.studentData.grade" />
            </div>
            <div>
              <div>
                <PvCheckbox binary v-model="localUserData.testData" />
                <label class="ml-2">Test Data? <span class="admin-only">*</span></label>
              </div>
              <div>
                <PvCheckbox binary v-model="localUserData.demoData" />
                <label class="ml-2">Demo Data? <span class="admin-only">*</span></label>
              </div>
            </div>
          </div>
          <div class="form-column">
            <div class="form-field">
              <label>Gender</label>
              <PvInputText v-model="localUserData.studentData.gender" />
            </div>

            <div class="form-field">
              <label>English as a Second Language</label>
              <PvDropdown
                v-model="localUserData.studentData.ell_status"
                optionLabel="label"
                optionValue="value"
                :options="binaryDropdownOptions"
              />
            </div>
            <div class="form-field">
              <label>IEP Status</label>
              <PvDropdown
                v-model="localUserData.studentData.iep_status"
                optionLabel="label"
                optionValue="value"
                :options="binaryDropdownOptions"
              />
            </div>
            <div class="form-field">
              <label>Free-Reduced Lunch</label>
              <PvDropdown
                v-model="localUserData.studentData.frl_status"
                optionLabel="label"
                optionValue="value"
                :options="binaryDropdownOptions"
              />
            </div>

            <div class="form-field">
              <label for="race">Race </label>
              <PvAutoComplete
                v-model="localUserData.studentData.race"
                multiple
                :suggestions="raceOptions"
                name="race"
                @complete="searchRaces"
              />
            </div>
            <div class="form-field">
              <label>Hispanic or Latino Ethnicity</label>
              <PvDropdown
                v-model="localUserData.studentData.hispanic_ethnicity"
                optionLabel="label"
                optionValue="value"
                :options="binaryDropdownOptions"
              />
            </div>
          </div>
        </div>
        <div v-else-if="localUserType === 'admin'">Admin Edit User Modal Under Construction</div>

        <!-- End fields for userData form-->
        <!-- <div class="flex align-items-center gap-2 mt-4"> -->
        <div class="modal-footer">
          <PvButton tabindex="0" text label="Cancel" outlined @click="rejectCallback"></PvButton>
          <PvButton tabindex="0" label="Save" @click="acceptCallback"></PvButton>
        </div>
      </div>
    </template>
  </PvConfirmDialog>
</template>
<script setup>
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { watch, ref, onMounted, computed } from 'vue';
const props = defineProps({
  userData: {
    type: Object,
    required: true,
  },
  isEnabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  userType: {
    type: String,
    default: 'student',
  },
});

// Handle modal opening / closing
const emit = defineEmits(['modalClosed']);

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);

watch(
  () => props.isEnabled,
  (isEnabled) => {
    console.log('isEnabled from watcher', isEnabled);
    if (isEnabled) {
      localUserData.value = setupUserData();
      console.log('userData', localUserData.value);
      requireConfirmModal();
    }
  },
);

const confirm = useConfirm();
const toast = useToast();
const requireConfirmModal = () => {
  confirm.require({
    group: 'headless',
    header: 'Are you sure?',
    message: 'Please confirm to proceed.',
    accept: async () => {
      console.log('Accepted');
      console.log('userData to send', localUserData.value);
      // await roarfirekit.value
      //   .updateUserData(props.userData.id, localUserData.value)
      //   .then((res) => {
      //     toast.add({ severity: 'success', summary: 'Updated', detail: 'User has been updated', life: 3000 });
      //   })
      //   .catch((error) => {
      //     console.log('error', error);
      //   });
      emit('modalClosed');
    },
    reject: () => {
      console.log('Rejected');
      emit('modalClosed');
    },
  });
};

// Utility functions
const localUserData = ref({});

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
  };
  return user;
};

const localUserType = computed(() => {
  if (props.userData?.userType) return props.userData.userType;
  if (props.userType) return props.userType;
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
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});
</script>
<style lang="scss">
.form-container {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  width: 100%;
  padding-right: 2rem;
  padding-left: 2rem;
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
  margin-top: 2rem;
  display: flex;
  flex-direction: row;
  margin-left: 2rem;
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
.modal-footer {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  width: 100%;
  gap: 1rem;
  padding: 2rem;
  background-color: #e6e7eb;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
}
</style>
