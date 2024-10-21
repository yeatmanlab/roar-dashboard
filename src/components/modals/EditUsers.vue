<template>
  <PvDialog :visible="isOpen" modal @update:visible="closeModal">
    <template #header>
      <div class="modal-header gap-2">
        <i class="pi pi-pencil text-gray-400 modal-icon"></i>
        <div class="flex flex-column">
          <h1 class="modal-title admin-page-header">
            {{ showPassword ? 'Change Password' : 'Edit User Information' }} - {{ localUserData.name.first }}
            {{ localUserData.name.last }}
          </h1>
          <span class="text-md text-gray-500">Modify, add, or remove user information</span>
        </div>
      </div>
    </template>
    <div class="flex flex-column align-items-center surface-overlay border-round" style="width: 66vw; gap: 2rem">
      <!-- Body of Modal -->
      <div v-if="localUserType === 'student'" class="form-container">
        <!-- User Information View -->
        <div v-if="!showPassword" class="flex flex-row" style="gap: 1rem">
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
              <label
                >Date of Birth
                <span v-if="localUserType === 'student'" v-tooltip.top="'Required'" class="required">*</span></label
              >
              <PvCalendar
                v-model="localUserData.studentData.dob"
                :class="{ 'p-invalid': errorMessage.includes('Date of birth') }"
              />
              <small v-if="errorMessage.includes('Date of birth')" class="p-error"
                >Date of Birth can not be in the future.</small
              >
            </div>

            <div class="form-field">
              <label
                >Grade
                <span v-if="localUserType === 'student'" v-tooltip.top="'Required'" class="required">*</span></label
              >
              <PvInputText
                v-model="localUserData.studentData.grade"
                :class="{ 'p-invalid': errorMessage.includes('Grade') }"
              />
              <small v-if="errorMessage.includes('Grade')" class="p-error"
                >Grade must be a number 1-13, or K/PK/TK</small
              >
            </div>
            <div v-if="isSuperAdmin">
              <div>
                <PvCheckbox v-model="localUserData.testData" binary />
                <label class="ml-2"
                  >Test Data? <span v-tooltip.top="'Super Admin Only'" class="admin-only">*</span></label
                >
              </div>
              <div>
                <PvCheckbox v-model="localUserData.demoData" binary />
                <label class="ml-2"
                  >Demo Data? <span v-tooltip.top="'Super Admin Only'" class="admin-only">*</span></label
                >
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
                option-label="label"
                option-value="value"
                :options="binaryDropdownOptions"
              />
            </div>
            <div class="form-field">
              <label>IEP Status</label>
              <PvDropdown
                v-model="localUserData.studentData.iep_status"
                option-label="label"
                option-value="value"
                :options="binaryDropdownOptions"
              />
            </div>
            <div class="form-field">
              <label>Free-Reduced Lunch</label>
              <PvDropdown
                v-model="localUserData.studentData.frl_status"
                option-label="label"
                option-value="value"
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
                option-label="label"
                option-value="value"
                :options="binaryDropdownOptions"
              />
            </div>
          </div>
        </div>
        <!-- Bottom of form-->
        <PvButton
          v-if="!showPassword"
          class="border-none border-round bg-primary text-white p-2 hover:surface-400 mr-auto ml-auto"
          @click="showPassword = true"
          >Change Password</PvButton
        >
        <!-- Show password view -->
        <div v-if="showPassword">
          <div class="flex" style="gap: 1rem">
            <div class="form-field" style="width: 100%">
              <label>New Password</label>
              <PvInputText v-model="newPassword" :class="{ 'p-invalid': errorMessage.includes('6 characters') }" />
              <small v-if="errorMessage.includes('6 characters')" class="p-error"
                >Password must be at least 6 characters.</small
              >
            </div>
            <div class="form-field" style="width: 100%">
              <label>Confirm New Password</label>
              <PvInputText v-model="confirmPassword" :class="{ 'p-invalid': errorMessage.includes('do not match') }" />
              <small v-if="errorMessage.includes('do not match')" class="p-error">Passwords do not match.</small>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="localUserType === 'admin'">Admin Edit User Modal Under Construction</div>

      <!-- End fields for userData form-->
    </div>
    <template #footer>
      <div class="modal-footer">
        <div v-if="!showPassword">
          <PvButton
            tabindex="0"
            class="border-none border-round bg-white text-primary p-2 hover:surface-200"
            text
            label="Cancel"
            outlined
            @click="onReject"
          ></PvButton>
          <PvButton
            tabindex="0"
            class="border-none border-round bg-primary text-white p-2 hover:surface-400"
            label="Save"
            @click="onAccept"
            ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"></i
          ></PvButton>
        </div>
        <div v-else-if="showPassword">
          <PvButton
            tabindex="0"
            class="border-none border-round bg-white text-primary p-2 hover:surface-200"
            text
            label="Back to User Information"
            outlined
            @click="showPassword = false"
          ></PvButton>
          <PvButton
            tabindex="0"
            class="border-none border-round bg-primary text-white p-2 hover:surface-400"
            label="Save Password"
            @click="updatePassword"
            ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"></i
          ></PvButton>
        </div>
      </div>
    </template>
    <!-- </template> -->
  </PvDialog>
</template>
<script setup>
import { watch, ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

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
      isOpen.value = true;
    }
  },
);

const toast = useToast();

// Handle Modal Actions
const closeModal = () => {
  errorMessage.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  showPassword.value = false;
  isOpen.value = false;
  emit('modalClosed');
};

const onAccept = async () => {
  errorMessage.value = '';
  isSubmitting.value = true;
  await roarfirekit.value
    .updateUserData(props.userData.id, { ...localUserData.value })
    .then(() => {
      isSubmitting.value = false;
      closeModal();
      toast.add({ severity: 'success', summary: 'Updated', detail: 'User has been updated', life: 3000 });
    })
    .catch((error) => {
      console.log('Error occurred during submission:', error);
      errorMessage.value = error.message;
      isSubmitting.value = false;
    });
};

const updatePassword = async () => {
  if (newPassword.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match';
    return;
  }
  isSubmitting.value = true;

  await roarfirekit.value
    .updateUserData(props.userData.id, { password: newPassword.value })
    .then(() => {
      isSubmitting.value = false;
      showPassword.value = false;
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Password has been updated', life: 3000 });
    })
    .catch((error) => {
      console.log('Error occurred during submission:', error);
      errorMessage.value = error.message;
      isSubmitting.value = false;
    });
};

const onReject = () => {
  closeModal();
};

// Utility functions
const isOpen = ref(false);
const localUserData = ref({});
const newPassword = ref('');
const confirmPassword = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const showPassword = ref(false);

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
  return null;
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
  flex-direction: column;
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
.modal-footer {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  width: 100%;
  padding: 1.5rem;
  background-color: #e6e7eb;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
  & div {
    display: flex;
    gap: 1rem;
  }
}
.p-dialog .p-dialog-footer {
  padding: 0;
}
.divider {
  width: 100%;
  text-align: center;
  border-bottom: 1px solid var(--gray-400);
  line-height: 0.1em;
  margin: 10px 0 20px;
}

.divider span {
  background: #fff;
  padding: 0 10px;
  user-select: none;
}
</style>
