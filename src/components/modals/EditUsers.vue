<template>
  <PvDialog :visible="isOpen" modal @update:visible="closeModal">
    <template #header>
      <div class="modal-header gap-2">
        <i class="pi pi-pencil text-gray-400 modal-icon"></i>
        <div class="flex flex-column">
          <h1 class="modal-title admin-page-header">
            {{ showPassword ? "Change Password" : "Edit User Information" }} -
            {{ localUserData.name.first }}
            {{ localUserData.name.last }}
          </h1>
          <span class="text-md text-gray-500"
            >Modify, add, or remove user information</span
          >
        </div>
      </div>
    </template>
    <div
      class="flex flex-column align-items-center surface-overlay border-round"
      style="width: 66vw; gap: 2rem"
    >
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
                <span
                  v-if="localUserType === 'student'"
                  v-tooltip.top="'Required'"
                  class="required"
                  >*</span
                ></label
              >
              <PvDatePicker
                v-model="localUserData.studentData.dob"
                :class="{ 'p-invalid': errorMessage.includes('Date of birth') }"
              />
              <small
                v-if="errorMessage.includes('Date of birth')"
                class="p-error"
                >Date of Birth can not be in the future.</small
              >
            </div>

            <div class="form-field">
              <label
                >Grade
                <span
                  v-if="localUserType === 'student'"
                  v-tooltip.top="'Required'"
                  class="required"
                  >*</span
                ></label
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
                  >Test Data?
                  <span v-tooltip.top="'Super Admin Only'" class="admin-only"
                    >*</span
                  ></label
                >
              </div>
              <div>
                <PvCheckbox v-model="localUserData.demoData" binary />
                <label class="ml-2"
                  >Demo Data?
                  <span v-tooltip.top="'Super Admin Only'" class="admin-only"
                    >*</span
                  ></label
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
              <PvSelect
                v-model="localUserData.studentData.ell_status"
                option-label="label"
                option-value="value"
                :options="binaryDropdownOptions"
              />
            </div>
            <div class="form-field">
              <label>IEP Status</label>
              <PvSelect
                v-model="localUserData.studentData.iep_status"
                option-label="label"
                option-value="value"
                :options="binaryDropdownOptions"
              />
            </div>
            <div class="form-field">
              <label>Free-Reduced Lunch</label>
              <PvSelect
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
              <PvSelect
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
              <PvInputText
                v-model="newPassword"
                :class="{ 'p-invalid': errorMessage.includes('6 characters') }"
              />
              <small
                v-if="errorMessage.includes('6 characters')"
                class="p-error"
                >Password must be at least 6 characters.</small
              >
            </div>
            <div class="form-field" style="width: 100%">
              <label>Confirm New Password</label>
              <PvInputText
                v-model="confirmPassword"
                :class="{ 'p-invalid': errorMessage.includes('do not match') }"
              />
              <small
                v-if="errorMessage.includes('do not match')"
                class="p-error"
                >Passwords do not match.</small
              >
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="localUserType === 'admin'">
        Admin Edit User Modal Under Construction
      </div>

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
<script setup lang="ts">
import { watch, ref, onMounted, computed } from "vue";
import { useToast } from "primevue/usetoast";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/store/auth";
import PvAutoComplete from "primevue/autocomplete";
import PvButton from "primevue/button";
import PvDatePicker from "primevue/datepicker";
import PvCheckbox from "primevue/checkbox";
import PvDialog from "primevue/dialog";
import PvSelect from "primevue/select";
import PvInputText from "primevue/inputtext";
import useUserClaimsQuery from "@/composables/queries/useUserClaimsQuery";

interface StudentData {
  dob: Date | null;
  grade: string;
  gender: string;
  race: string[];
  hispanic_ethnicity: boolean;
  ell_status: boolean;
  frl_status: boolean;
  iep_status: boolean;
}

interface UserName {
  first: string | null;
  middle: string | null;
  last: string | null;
}

interface UserData {
  id?: string;
  name: UserName;
  studentData: StudentData;
  testData: boolean;
  demoData: boolean;
  userType: string | null;
}

interface Props {
  userData: UserData;
  isEnabled: boolean;
  userType?: string;
}

interface Emits {
  (e: "modalClosed"): void;
}

interface DropdownOption {
  label: string;
  value: boolean;
}

interface AutoCompleteEvent {
  query: string;
}

const props = withDefaults(defineProps<Props>(), {
  isEnabled: false,
  userType: "student",
});

// Handle modal opening / closing
const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref<boolean>(false);

watch(
  () => props.isEnabled,
  (isEnabled: boolean) => {
    console.log("isEnabled from watcher", isEnabled);
    if (isEnabled) {
      localUserData.value = setupUserData();
      console.log("userData", localUserData.value);
      isOpen.value = true;
    }
  },
);

const toast = useToast();

// Handle Modal Actions
const closeModal = (): void => {
  errorMessage.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  showPassword.value = false;
  isOpen.value = false;
  emit("modalClosed");
};

const onAccept = async (): Promise<void> => {
  errorMessage.value = "";
  isSubmitting.value = true;
  await roarfirekit.value
    .updateUserData(props.userData.id, { ...localUserData.value })
    .then(() => {
      isSubmitting.value = false;
      closeModal();
      toast.add({
        severity: "success",
        summary: "Updated",
        detail: "User has been updated",
        life: 3000,
      });
    })
    .catch((error: any) => {
      console.log("Error occurred during submission:", error);
      errorMessage.value = error.message;
      isSubmitting.value = false;
    });
};

const updatePassword = async (): Promise<void> => {
  if (newPassword.value.length < 6) {
    errorMessage.value = "Password must be at least 6 characters";
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match";
    return;
  }
  isSubmitting.value = true;

  await roarfirekit.value
    .updateUserData(props.userData.id, { password: newPassword.value })
    .then(() => {
      isSubmitting.value = false;
      showPassword.value = false;
      toast.add({
        severity: "success",
        summary: "Updated",
        detail: "Password has been updated",
        life: 3000,
      });
    })
    .catch((error: any) => {
      console.log("Error occurred during submission:", error);
      errorMessage.value = error.message;
      isSubmitting.value = false;
    });
};

const onReject = (): void => {
  closeModal();
};

// Utility functions
const isOpen = ref<boolean>(false);
const localUserData = ref<UserData>({} as UserData);
const newPassword = ref<string>("");
const confirmPassword = ref<string>("");
const isSubmitting = ref<boolean>(false);
const errorMessage = ref<string>("");
const showPassword = ref<boolean>(false);

const setupUserData = (): UserData => {
  let user: UserData = {
    name: {
      first: props.userData?.name?.first || null,
      middle: props.userData?.name?.middle || null,
      last: props.userData?.name?.last || null,
    },
    studentData: {
      dob: !isNaN(new Date(props.userData?.studentData?.dob).getTime())
        ? new Date(props.userData?.studentData?.dob)
        : null,
      grade: props.userData?.studentData?.grade || "",
      gender: props.userData?.studentData?.gender || "",
      race: props.userData?.studentData?.race || [],
      hispanic_ethnicity:
        props.userData?.studentData?.hispanic_ethnicity || false,
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

const localUserType = computed<string | null>(() => {
  if (props.userData?.userType) return props.userData.userType;
  if (props.userType) return props.userType;
  return null;
});

const races: string[] = [
  "american Indian or alaska Native",
  "asian",
  "black or african American",
  "native hawaiian or other pacific islander",
  "white",
];

const raceOptions = ref<string[]>([...races]);
const binaryDropdownOptions: DropdownOption[] = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

const searchRaces = (event: AutoCompleteEvent): void => {
  const query = event.query.toLowerCase();

  let filteredOptions = races.filter((opt) =>
    opt.toLowerCase().includes(query),
  );

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }

  raceOptions.value = filteredOptions;
};

let unsubscribe: (() => void) | undefined;
const init = (): void => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation: any, state: any) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

// Determine if the user is an admin
const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const isSuperAdmin = computed<boolean>(() => {
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
