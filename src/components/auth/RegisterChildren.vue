<template>
  <div class="card">
    <form class="">
      <div
        v-for="(student, outerIndex) in state.students"
        :key="outerIndex"
        class="flex gap-2 px-5 py-3 my-3 bg-gray-100 rounded flex-column"
      >
        <div class="flex flex-column justify-content-between align-items-center">
          <div class="text-2xl font-bold text-gray-600">Student #{{ outerIndex + 1 }}</div>
          <section v-if="!student.orgName" class="form-section">
            <div class="p-input-icon-right">
              <div class="flex gap-2 justify-content-between">
                <label for="activationCode">Activation code <span class="required">*</span></label>
              </div>
              <PvInputGroup v-if="!student.noActivationCode" data-cy="activation-code-group">
                <PvInputText
                  v-model="student.activationCode"
                  name="activationCode"
                  data-cy="activation-code-input"
                  placeholder="Enter activation code"
                  :class="{
                    'p-invalid': v$.students.$each.$response.$data[outerIndex].activationCode.$invalid && submitted,
                  }"
                  aria-describedby="activation-code-error"
                  :disabled="student.noActivationCode"
                />
                <PvButton
                  class="w-4 text-sm text-white bg-primary hover:bg-red-900"
                  label="Validate"
                  @click="validateCode(student.activationCode, outerIndex)"
                />
              </PvInputGroup>
            </div>
            <span
              v-if="
                v$.students.$each.$response.$data[outerIndex].noActivationCode &&
                v$.students.$each.$response.$data[outerIndex].activationCode.$invalid &&
                submitted
              "
            >
              <span
                v-for="(error, innerIndex) in v$.students.$each.$response.$errors[outerIndex].activationCode"
                :key="`error-${outerIndex}-${innerIndex}`"
              >
                <small class="p-error">{{ error.$message.replace('Value', 'Activation Code') }}</small>
              </span>
            </span>
          </section>
          <section v-else>
            <div class="flex my-2 justify-content-between align-items-center">
              <div class="gap-2 flex-column">
                <div class="text-xs font-light text-gray-500 uppercase">Registering under</div>
                <div class="flex gap-2 p-2 bg-gray-200 rounded">
                  <div class="text-sm font-bold text-gray-600" data-cy="child-registration__org-name">
                    {{ student.orgName }}
                  </div>
                </div>
                <div>
                  <PvButton
                    class="py-2 text-white border-none bg-primary border-round hover:surface-300 hover:text-black-alpha-90 text-md"
                    icon="pi pi-replay ml-2"
                    icon-pos="right"
                    severity="secondary"
                    label="Enter another code"
                    @click="codeNotRight(outerIndex)"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
        <section class="form-section">
          <div class="flex p-input-icon-right flex-column">
            <label for="studentUsername">Student Username <span class="required">*</span></label>
            <PvInputText
              v-model="student.studentUsername"
              name="studentUsername"
              :class="{
                'p-invalid': v$.students.$each.$response.$data[outerIndex].studentUsername.$invalid && submitted,
              }"
              aria-describedby="username-error"
            />
          </div>
          <span
            v-if="v$.students.$each.$response.$data[outerIndex].studentUsername.$invalid && submitted"
            class="p-error"
          >
            <small class="p-error">Please enter a valid username.</small>
          </span>
        </section>
        <!-- Password -->
        <section class="flex form-section lg:flex-row">
          <div>
            <div>
              <label for="password">Password (Minimum 6 characters)<span class="required">*</span></label>
              <PvPassword
                v-model="student.password"
                name="password"
                :class="{
                  'p-invalid': v$.students.$each.$response.$data[outerIndex].password.$invalid && submitted,
                  'w-full': true,
                }"
                :input-props="{ autocomplete: 'new-password' }"
                :feedback="false"
                show-icon="pi pi-eye-slash"
                hide-icon="pi pi-eye"
                toggle-mask
              ></PvPassword>
            </div>
            <span v-if="v$.students.$each.$response.$errors[outerIndex].password.length > 0 && submitted">
              <span
                v-for="(error, innerIndex2) in v$.students.$each.$response.$errors[outerIndex].password"
                :key="`error-${outerIndex}-${innerIndex2}`"
              >
                <small class="p-error">{{ error.$message.replace('Value', 'Password') }}</small>
              </span>
            </span>
          </div>
          <!-- Confirm Password -->
          <div>
            <div>
              <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
              <PvPassword
                :id="`confirmPassword-${isRegistering ? 'register' : 'login'}`"
                v-model="student.confirmPassword"
                name="confirmPassword"
                :class="{ 'p-invalid': isPasswordMismatch(outerIndex) && submitted, 'w-full': true }"
                :input-props="{ autocomplete: 'new-password' }"
                :feedback="false"
                show-icon="pi pi-eye-slash"
                hide-icon="pi pi-eye"
                toggle-mask
              ></PvPassword>
            </div>
            <span v-if="isPasswordMismatch(outerIndex)" class="p-error"> Passwords must match </span>
          </div>
        </section>
        <section class="form-section">
          <div>
            <!-- Age / DOB -->
            <div class="flex gap-2 justify-content-start">
              <label>Date of Birth <span class="required">*</span></label>
              <div class="flex align-items-center">
                <PvCheckbox v-model="student.yearOnlyCheckRef" :binary="true" name="yearOnly" />
                <label for="yearOnly" class="ml-2">Use Year Only</label>
              </div>
            </div>
            <div v-if="!student.yearOnlyCheckRef">
              <PvDatePicker
                v-model="student.dob"
                :max-date="maxDoB"
                class="w-full"
                view="date"
                date-format="mm/dd/yy"
                icon="pi pi-calendar text-white p-1"
              />
            </div>
            <div v-else>
              <PvDatePicker
                v-model="student.dob"
                :max-date="maxDoB"
                class="w-full"
                view="year"
                date-format="yy"
                icon="pi pi-calendar text-white p-1"
              />
            </div>
            <small v-if="v$.students.$each.$response.$data[outerIndex].dob.$invalid && submitted" class="p-error">{{
              v$.students.$each.$response.$errors[outerIndex].dob.$message.replace('Value', 'Date of Birth')
            }}</small>
          </div>
          <div class="flex flex-column">
            <label for="grade">Grade <span class="required">*</span></label>
            <PvSelect
              v-model="student.grade"
              :options="gradeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              name="grade"
            />
          </div>
        </section>
        <section class="form-section">
          <!--Grade-->
        </section>
        <PvAccordion expand-icon="pi pi-angle-down">
          <PvAccordionTab header="Optional Info">
            <!--First / Last Name-->
            <section class="form-section">
              <div class="flex flex-wrap">
                <label for="firstName">First Name </label>
                <PvInputText
                  v-model="student.firstName"
                  name="firstName"
                  :class="{
                    'p-invalid': v$.students.$each.$response.$data[outerIndex]?.firstName.$invalid,
                    'w-full': true,
                  }"
                  aria-describedby="first-name-error"
                />
              </div>
              <!-- Middle Name -->
              <div>
                <label for="middleName">Middle Name </label>
                <PvInputText v-model="student.middleName" name="middleName" />
              </div>
              <div class="flex flex-column">
                <label for="lastName">Last Name </label>
                <PvInputText
                  v-model="student.lastName"
                  name="lastName"
                  :class="{
                    'p-invalid': v$.students.$each.$response.$data[outerIndex]?.lastName.$invalid,
                    'w-full': true,
                  }"
                  aria-describedby="first-name-error"
                />
              </div>
            </section>
            <section class="form-section">
              <!--English Language Level-->
              <div class="mt-2 mb-3">
                <label for="ell">English as a Second Language</label>
                <PvSelect
                  v-model="student.ell"
                  :options="ellOptions"
                  option-label="label"
                  option-value="value"
                  name="ell"
                />
              </div>
              <!--Sex-->
              <div class="flex mt-2 mb-3 flex-column">
                <label for="sex">Gender </label>
                <PvSelect
                  v-model="student.gender"
                  :options="genderOptions"
                  option-label="label"
                  option-value="value"
                  name="gender"
                />
              </div>
            </section>
            <section class="mt-2 mb-3 form-section">
              <!-- Free-Reduced Lunch -->
              <div class="flex flex-column">
                <label for="stateId">Free-Reduced Lunch </label>
                <PvSelect
                  v-model="student.freeReducedLunch"
                  :options="frlOptions"
                  option-label="label"
                  option-value="value"
                  name="freeReducedLunch"
                />
              </div>
              <!-- IEP Status -->
              <div class="flex flex-column">
                <label for="stateId">IEP Status</label>
                <PvSelect
                  v-model="student.IEPStatus"
                  :options="IEPOptions"
                  option-label="label"
                  option-value="value"
                  name="IEPStatus"
                />
              </div>
            </section>
            <section class="flex flex-row mt-2 mb-3 form-section">
              <!-- Race -->
              <div class="flex flex-column">
                <label for="race">Race </label>
                <PvAutoComplete
                  v-model="student.race"
                  multiple
                  :suggestions="raceOptions"
                  name="race"
                  @complete="searchRaces"
                />
              </div>
              <!-- Hispanic Ethinicity -->
              <div class="flex flex-column">
                <label for="hispanicEthnicity">Hispanic or Latino Ethnicity </label>
                <PvSelect
                  v-model="student.hispanicEthnicity"
                  :options="ethnicityOptions"
                  option-label="label"
                  option-value="value"
                  name="hispanicEthinicity"
                />
              </div>
              <div class="flex flex-column">
                <label for="stateId">Home Language </label>
                <PvAutoComplete
                  v-model="student.homeLanguage"
                  multiple
                  :suggestions="languageOptions"
                  name="homeLanguage"
                  @complete="searchLanguages"
                />
              </div>
            </section>
          </PvAccordionTab>
        </PvAccordion>
        <section class="form-section-button">
          <PvButton
            v-if="outerIndex !== 0"
            class="p-3 w-5 text-white border-none bg-primary border-round hover:surface-300 hover:text-black-alpha-90"
            icon="pi pi-trash"
            @click="deleteStudentForm(outerIndex)"
          >
            <i class="mr-2 pi pi-trash"></i>
            Delete Student
          </PvButton>
        </section>
        <ChallengeV3 v-model="response" action="submit">
          <div class="field-checkbox terms-checkbox">
            <PvCheckbox
              :id="`accept-${isRegistering ? 'register' : 'login'}`"
              v-model="student.accept"
              binary
              :disabled="showConsent[outerIndex]"
              :class="[{ 'p-invalid': student.accept.$invalid && submitted }]"
              @change="getConsent(outerIndex)"
            />
            <label for="accept" :class="{ 'p-error': student.accept.$invalid && submitted }"
              >I agree to the terms and conditions<span class="required">*</span></label
            >
          </div>
          <small v-if="(student.accept.$invalid && submitted) || student.accept.$pending" class="p-error">
            You must agree to the terms and conditions
          </small>
        </ChallengeV3>
        <ConsentModal
          v-if="showConsent[outerIndex]"
          :consent-text="consentText"
          consent-type="consent"
          :on-confirm="() => handleConsentAccept(outerIndex)"
        />
      </div>
    </form>
    <div class="form-section-button2">
      <PvButton
        class="p-3 text-white border-none bg-primary border-round hover:surface-300 hover:text-black-alpha-90"
        icon="pi pi-plus"
        label="Add Student"
        @click="addStudent()"
      >
      </PvButton>
    </div>
    <section class="flex mt-8 justify-content-end">
      <PvButton
        type="submit"
        label="Submit"
        class="p-2 mr-3 w-4 text-white border-none bg-primary border-round h-3rem hover:surface-300 hover:text-black-alpha-90"
        :loading="props.submitting"
        :disabled="props.submitting"
        @click.prevent="handleFormSubmit(!v$.$invalid && !anyPasswordsMismatched())"
      />
      <PvDialog
        v-model:visible="isDialogVisible"
        header="Error!"
        :style="{ width: '25rem' }"
        :modal="true"
        :draggable="false"
      >
        <p>{{ dialogMessage }}</p>
        <PvButton
          class="p-2 mr-3 text-white border-none bg-primary border-round h-3rem hover:surface-300 hover:text-black-alpha-90"
          @click="closeErrorDialog"
          >Close</PvButton
        >
      </PvDialog>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, toRaw } from 'vue';
import { required, minLength, helpers, sameAs } from '@vuelidate/validators';
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';
import PvButton from 'primevue/button';
import PvDatePicker from 'primevue/datepicker';
import PvCheckbox from 'primevue/checkbox';
import PvDialog from 'primevue/dialog';
import PvSelect from 'primevue/select';
import PvInputGroup from 'primevue/inputgroup';
import PvInputText from 'primevue/inputtext';
import PvPassword from 'primevue/password';
import ConsentModal from '../ConsentModal.vue';
import { fetchDocById } from '@/helpers/query/utils';
import { useVuelidate } from '@vuelidate/core';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import PvAutoComplete from 'primevue/autocomplete';
import { ChallengeV3 } from 'vue-recaptcha';

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const dialogMessage = ref('');

const today = new Date();
today.setFullYear(today.getFullYear() - 2);
const maxDoB = ref(today);
const orgName = ref('');
const consentText = ref('');
const activationCodeRef = ref('');

const props = defineProps({
  isRegistering: { type: Boolean, default: true },
  code: { type: String, default: null },
  consent: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
});

const isDialogVisible = ref(false);
const submitted = ref(false);

const showConsent = ref([false]);
const isCaptchaverified = ref(null);

async function handleConsentAccept(outerIndex) {
  state.students[outerIndex].accept = true;
}

function handleCaptcha() {
  isCaptchaverified.value = response.value;
}

async function handleCheckCaptcha() {
  await new Promise((resolve) => {
    // Simulate a delay to ensure the reCAPTCHA value is updated
    setTimeout(() => {
      resolve();
      handleCaptcha();
    }, 500); // You might adjust the delay time if needed
  });
}

async function getConsent(outerIndex) {
  try {
    const consentDoc = await authStore.getLegalDoc('consent-behavioral-eye-tracking');
    consentText.value = consentDoc.text;
    showConsent.value[outerIndex] = true;
    handleCheckCaptcha();
  } catch (error) {
    console.error('Failed to fetch consent form: ', error);
    throw new Error('Could not fetch consent form');
  }
}

const showErrorDialog = () => {
  isDialogVisible.value = true;
};

const closeErrorDialog = () => {
  isDialogVisible.value = false;
};

const noActivationCodeRef = ref(false);
const yearOnlyCheckRef = ref(false);

const emit = defineEmits(['submit']);
const state = reactive({
  students: [
    {
      activationCode: activationCodeRef.value,
      studentUsername: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      middleName: '',
      dob: '',
      grade: '',
      ell: '',
      gender: '',
      freeReducedLunch: '',
      IEPStatus: '',
      race: [],
      hispanicEthnicity: '',
      homeLanguage: [],
      noActivationCode: noActivationCodeRef.value,
      yearOnlyCheck: yearOnlyCheckRef.value,
      orgName: '',
      accept: false,
    },
  ],
});

const rules = {
  students: {
    $each: helpers.forEach({
      activationCode: {},
      studentUsername: { required },
      password: { required, minLength: minLength(6) },
      confirmPassword: { required },
      firstName: {},
      lastName: {},
      middleName: {},
      dob: { required },
      grade: { required },
      ell: {},
      gender: {},
      freeReducedLunch: {},
      IEPStatus: {},
      race: {},
      hispanicEthnicity: {},
      homeLanguage: {},
      noActivationCode: {},
      yearOnlyCheck: {},
      orgName: {},
      accept: { sameAs: sameAs(true) },
    }),
  },
};

const response = ref(null);

function addStudent() {
  state.students.push({
    activationCode: '',
    studentUsername: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    middleName: '',
    dob: '',
    grade: '',
    ell: '',
    gender: '',
    freeReducedLunch: '',
    IEPStatus: '',
    race: [],
    hispanicEthnicity: '',
    homeLanguage: [],
    noActivationCode: noActivationCodeRef.value,
    yearOnlyCheck: yearOnlyCheckRef.value,
    orgName: '',
    accept: false,
  });
  showConsent.value.push(false);
  if (props.code) {
    validateCode(props.code, state.students.length - 1);
  }
}

onMounted(async () => {
  if (props.code) {
    validateCode(props.code);
  }
});

function codeNotRight(index) {
  state.students[index].orgName = '';
  state.students[index].noActivationCode = false;
}

function deleteStudentForm(student) {
  if (state.students.length > 1) {
    state.students.splice(student, 1); // Remove the student at the specified index
    showConsent.value.splice(student, 1);
  } else {
    alert('At least one student is required.'); // Prevent deleting the last student form
    submitted.value = false;
  }
}
function isPasswordMismatch(index) {
  return state.students[index].password !== state.students[index]?.confirmPassword;
}

function anyPasswordsMismatched() {
  return state.students.some((student) => student.password !== student.confirmPassword);
}

const v$ = useVuelidate(rules, state);

const handleFormSubmit = async (isFormValid) => {
  submitted.value = true;

  if (!isFormValid) {
    dialogMessage.value = 'There is an error with the form input, please correct and re-try.';
    showErrorDialog();
    return;
  }

  const validationPromises = toRaw(state).students.map(async (student, index) => {
    const isCodeValid = await validateCode(student.activationCode, index);
    if (!isCodeValid && isCodeValid) {
      if (student.noActivationCode) {
        return false;
      }
    }
    return true;
  });

  const validationResults = await Promise.all(validationPromises);

  if (validationResults.includes(false)) {
    submitted.value = false;
    return;
  }

  if (await validateRoarUsername()) {
    // format username as an email
    if (isFormValid) {
      const computedStudents = toRaw(state).students.map((student) => {
        const { studentUsername, ...studentData } = student;
        return {
          studentUsername: `${studentUsername}@roar-auth.com`,
          ...studentData,
        };
      });
      emit('submit', computedStudents);
    }
  }
};

const validateCode = async (studentCode, outerIndex = 0) => {
  // @TODO: Add proper error handling.
  if (!studentCode || studentCode === '') return;

  try {
    const activationCode = await fetchDocById('activationCodes', studentCode, undefined, 'admin', true, true);
    // If two months have elapsed since creation, we should invalidate the code as expired
    if (activationCode.dateExpired) {
      const dateExpired = new Date(activationCode.dateExpired);
      const today = new Date();
      if (dateExpired < today) {
        dialogMessage.value = 'The code has expired. Please enter a valid code."';
        showErrorDialog();
        submitted.value = false;
        return;
      }
    }
    // if no dateExpired, fallback to dateCreated to check for validity
    else if (activationCode.dateCreated) {
      const dateCreated = new Date(activationCode.dateCreated);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      if (dateCreated < twoMonthsAgo) {
        dialogMessage.value = 'The code has expired. Please enter a valid code."';
        showErrorDialog();
        submitted.value = false;
        return;
      }
    }
    if (activationCode.orgId) {
      state.students[outerIndex].orgName = `${_capitalize(activationCode.orgType)} - ${
        activationCode.orgName ?? activationCode.orgId
      }`;
      state.students[outerIndex].activationCode = studentCode;
      orgName.value = `${_capitalize(activationCode.orgType)} - ${activationCode.orgName ?? activationCode.orgId}`;
    }
  } catch (error) {
    console.error('Failed to validate activation code', error);

    if (!state.students[outerIndex].noActivationCode || props.code) {
      dialogMessage.value = `The code ${studentCode} does not belong to any organization. Please enter a valid code.`;
    } else {
      dialogMessage.value = 'The code does not belong to any organization. Please enter a valid code."';
    }

    showErrorDialog();

    submitted.value = false;
  }
};

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

const searchLanguages = (event) => {
  const query = event.query.toLowerCase();

  let filteredOptions = languages.filter((opt) => opt.toLowerCase().includes(query));

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }

  languageOptions.value = filteredOptions;
};

const gradeOptions = ref([
  { label: 'PK', value: 'PK' },
  { label: 'TK', value: 'TK' },
  { label: 'K', value: 'K' },
  { label: '1st', value: '1' },
  { label: '2nd', value: '2' },
  { label: '3rd', value: '3' },
  { label: '4th', value: '4' },
  { label: '5th', value: '5' },
  { label: '6th', value: '6' },
  { label: '7th', value: '7' },
  { label: '8th', value: '8' },
  { label: '9th', value: '9' },
  { label: '10th', value: '10' },
  { label: '11th', value: '11' },
  { label: '12th', value: '12' },
]);

const genderOptions = ref([
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Nonbinary / Do not want to specify', value: 'dns' },
]);

const races = [
  'american Indian or alaska Native',
  'asian',
  'black or african American',
  'native hawaiian or other pacific islander',
  'hispanic or latino',
  'white',
];

const raceOptions = ref([...races]);

const frlOptions = ref([
  { label: 'Free', value: 'Free' },
  { label: 'Reduced', value: 'Reduced' },
  { label: 'Paid', value: 'Paid' },
  { label: 'N/A', value: 'N/A' },
]);

const IEPOptions = ref([
  { label: 'Yes', value: 'Y' },
  { label: 'No', value: 'N' },
]);

const ellOptions = ref([
  { label: 'Yes', value: 'Y' },
  { label: 'No', value: 'N' },
]);

const ethnicityOptions = ref([
  { label: 'Yes', value: 'Y' },
  { label: 'No', value: 'N' },
]);

// Top 20 languages spoken in the U.S.
const languages = [
  'English',
  'Spanish',
  'Chinese',
  'Tagalog',
  'Vietnamese',
  'Arabic',
  'French',
  'Korean',
  'Russian',
  'German',
  'Haitian Creole',
  'Hindi',
  'Portuguese',
  'Italian',
  'Polish',
  'Urdu',
  'Japanese',
  'Persian',
  'Gujarati',
  'Telugu',
];

const languageOptions = ref([...languages]);

const validateRoarUsername = async () => {
  for (const student of state.students) {
    const validUserName = await roarfirekit.value.isUsernameAvailable(student.studentUsername);
    if (!validUserName) {
      dialogMessage.value = 'Username: ' + student.studentUsername + ' is already in use';
      showErrorDialog();
      submitted.value = false;
      return false;
    }
  }
  return true;
};
</script>

<style scoped>
label {
  font-size: 0.875rem;
  font-weight: 300;
}

.stepper {
  margin: 2rem 0rem;
}

.p-fluid .p-button {
  width: 50%;
  align-items: center;
  justify-content: center;
  display: flex;
  background-color: var(--surface-300);
  border: var(--surface-300);
  color: black;
}
.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}
.required {
  color: var(--bright-red);
}
.login-title {
  font-size: 26px;
}
.submit-button {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  background-color: var(--primary-color);
  color: white;
  border: none;
  width: 11.75rem;
  justify-content: end;
  margin-right: 2rem;
}
.submit-button:hover {
  background-color: #b7b5b5;
  color: black;
}
.terms-checkbox {
  margin-top: 0;
  margin-bottom: 0.75rem;
}
.form-section-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}
.form-section-button2 {
  display: flex;
  width: 90%;
  justify-content: right;
  margin-left: 20px;
}
.form-section-button2 .p-button {
  width: 40%;
  margin-right: 0;
  justify-content: center;
  background: var(--surface-300);
  border: var(--surface-300);
  color: black;
}

.form-section-button2 .p-button:hover,
.p-fluid .p-button:hover {
  background-color: var(--primary-color);
  color: white;
  border: var(--primary-color);
}

@media screen and (max-width: 580px) {
  section {
    flex-direction: column !important;
  }
  input.p-inputtext.p-component {
    width: 200px;
  }
  .p-password.p-component.p-inputwrapper.p-input-icon-right {
    width: 200px;
  }
  div#confirmPassword-register {
    width: 200px;
  }

  .p-fluid {
    padding: 5px;
    margin: 0px;
  }
  .p-dropdown {
    width: 200px;
  }
}
</style>
