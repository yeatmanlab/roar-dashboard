<template>
  <div class="card">
    <form class="p-fluid">
      <div
        v-for="(student, outerIndex) in state.students"
        :key="outerIndex"
        class="student-form-border"
      >
      <section class="form-section">
        <div class="p-input-icon-right">
          <div class="flex justify-content-between">
            <label for="activationCode">Activation code <span class="required">*</span></label>
            <div class="flex align-items-center">
              <PvCheckbox
                v-model="noActivationCode"
                :binary="true"
                name="noActivationCode"
              />
              <label for="noActivationCode" class="ml-2">I don't have code</label>
            </div>
          </div>
          <PvInputText
            v-if="!noActivationCode"
            v-model="student.activationCode"
            name="activationCode"
            :class="{
              'p-invalid':
                v$.students.$each.$response.$data[outerIndex].activationCode
                  .$invalid && submitted,
            }"
            aria-describedby="activation-code-error"
            :disabled="noActivationCode"
          />
        </div>
        <span
          v-if="
            !noActivationCode &&
            v$.students.$each.$response.$data[outerIndex].activationCode
              .$invalid && submitted
          "
        >
          <span
            v-for="(error, innerIndex) in v$.students.$each.$response.$errors[outerIndex].activationCode"
            :key="`error-${outerIndex}-${innerIndex}`"
          >
            <small class="p-error">{{
              error.$message.replace("Value", "Activation Code")
            }}</small>
          </span>
        </span>
      </section>
        <section class="form-section">
          <div class="p-input-icon-right">
            <label for="studentUsername"
              >Student Username <span class="required">*</span></label
            >
            <PvInputText
              v-model="student.studentUsername"
              name="studentUsername"
              :class="{
                'p-invalid':
                  v$.students.$each.$response.$data[outerIndex].studentUsername
                    .$invalid && submitted,
              }"
              aria-describedby="username-error"
            />
          </div>
          <span
            v-if="
              v$.students.$each.$response.$data[outerIndex].studentUsername
                .$invalid && submitted
            "
            class="p-error"
          >
            <small class="p-error">Please enter a valid username.</small>
          </span>
        </section>
        <!-- Password -->
        <section class="form-section flex lg:flex-row">
          <div>
            <div>
              <label for="password"
                >Password <span class="required">*</span></label
              >
              <PvPassword
                v-model="student.password"
                name="password"
                :class="{
                  'p-invalid':
                    v$.students.$each.$response.$data[outerIndex].password
                      .$invalid && submitted,
                }"
                toggle-mask
                show-icon="pi pi-eye-slash"
                hide-icon="pi pi-eye"
                :feedback="false"
              ></PvPassword>
            </div>
            <span
              v-if="
                v$.students.$each.$response.$data[outerIndex].password.$invalid &&
                submitted
              "
            >
              <span
                v-for="(error, innerIndex2)  in v$.students.$each.$response.$errors[outerIndex].password"
                :key="`error-${outerIndex}-${innerIndex2}`"
              >
                <small class="p-error">{{
                  error.$message.replace("Value", "Password")
                }}</small>
              </span>
            </span>
          </div>
          <!-- Confirm Password -->
          <div>
            <div>
              <label for="confirmPassword"
                >Confirm Password <span class="required">*</span></label
              >
              <PvPassword
                :id="`confirmPassword-${isRegistering ? 'register' : 'login'}`"
                v-model="student.confirmPassword"
                name="confirmPassword"
                :class="{ 'p-invalid': isPasswordMismatch(outerIndex) && submitted }"
                toggle-mask
                show-icon="pi pi-eye-slash"
                hide-icon="pi pi-eye"
                :feedback="false"
              ></PvPassword>
            </div>
            <span v-if="isPasswordMismatch(outerIndex) && submitted" class="p-error">
              Passwords must match
            </span>
          </div>
        </section>
        <section class="form-section">
          <div>
            <!-- Age / DOB -->
            <div class="flex justify-content-between">
              <label>Date of Birth <span class="required">*</span></label>
              <div class="flex align-items-center">
                <PvCheckbox
                  v-model="yearOnlyCheck"
                  :binary="true"
                  name="yearOnly"
                />
                <label for="yearOnly" class="ml-2">Use Year Only</label>
              </div>
            </div>
            <div v-if="!yearOnlyCheck">
              <pvCalendar
                v-model="student.dob"
                view="date"
                date-format="mm/dd/yy"
                show-icon
              />
            </div>
            <div v-else>
              <PvCalendar
                v-model="student.dob"
                view="year"
                date-format="yy"
                model-value="string"
                show-icon
              />
            </div>
            <small
              v-if="
                v$.students.$each.$response.$data[outerIndex].dob.$invalid &&
                submitted
              "
              class="p-error"
              >{{v$.students.$each.$response.$errors[outerIndex].dob.$message.replace("Value", "Date of Birth")}}</small
            >
          </div>
        </section>
        <section class="form-section">
          <!--Grade-->
          <div>
            <label for="grade">Grade <span class="required">*</span></label>
            <PvDropdown
              v-model="student.grade"
              :options="gradeOptions"
              option-label="label"
              option-value="value"
              name="grade"
            />
            <!-- <small v-if="(v$.grade.$invalid && submitted) || v$.grade.$pending.$response" class="p-error">{{ v$.grade.required.$message.replace("Value", "Grade") }}</small> -->
          </div>
        </section>
        <PvAccordion>
          <PvAccordionTab header="Optional Info">
            <!--First / Last Name-->
            <section class="form-section">
              <div>
                <label for="firstName">First Name </label>
                <PvInputText
                  v-model="student.firstName"
                  name="firstName"
                  :class="{
                    'p-invalid':
                      v$.students.$each.$response.$data[index]?.firstName
                        .$invalid,
                  }"
                  aria-describedby="first-name-error"
                />
              </div>
              <!-- Middle Name -->
              <div>
                <label for="middleName">Middle Name </label>
                <PvInputText v-model="student.middleName" name="middleName" />
              </div>
            </section>
            <section class="form-section">
              <div>
                <label for="lastName">Last Name </label>
                <PvInputText
                  v-model="student.lastName"
                  name="lastName"
                  :class="{
                    'p-invalid':
                      v$.students.$each.$response.$data[index]?.lastName
                        .$invalid,
                  }"
                  aria-describedby="first-name-error"
                />
              </div>
            </section>
            <section class="form-section">
              <!--English Language Level-->
              <div class="mt-4 mb-5">
                <label for="ell">English as a Second Language</label>
                <PvDropdown
                  v-model="student.ell"
                  :options="ellOptions"
                  option-label="label"
                  option-value="value"
                  name="ell"
                />
              </div>
              <!--Sex-->
              <div class="mt-4 mb-5">
                <label for="sex">Gender </label>
                <PvDropdown
                  v-model="student.gender"
                  :options="genderOptions"
                  option-label="label"
                  option-value="value"
                  name="gender"
                />
              </div>
            </section>
            <section class="form-section">
              <!-- Free-Reduced Lunch -->
              <div class="mt-4 mb-5">
                <label for="stateId">Free-Reduced Lunch </label>
                <PvDropdown
                  v-model="student.freeReducedLunch"
                  :options="frlOptions"
                  option-label="label"
                  option-value="value"
                  name="freeReducedLunch"
                />
              </div>
              <!-- IEP Status -->
              <div class="mt-4 mb-5">
                <label for="stateId">IEP Status</label>
                <PvDropdown
                  v-model="student.IEPStatus"
                  :options="IEPOptions"
                  option-label="label"
                  option-value="value"
                  name="IEPStatus"
                />
              </div>
            </section>
            <section class="form-section">
              <!-- Race -->
              <div class="mt-4 mb-5">
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
              <div class="mt-4 mb-5">
                <label for="hispanicEthnicity"
                  >Hispanic or Latino Ethnicity
                </label>
                <PvDropdown
                  v-model="student.hispanicEthnicity"
                  :options="ethnicityOptions"
                  option-label="label"
                  option-value="value"
                  name="hispanicEthinicity"
                />
              </div>
            </section>
            <section class="form-section">
              <!-- Home Language -->
              <div class="mt-4 mb-5">
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
            v-if="index !== 0"
            class="p-button p-component"
            @click="deleteStudentForm(student)"
          >
            Delete Student
          </PvButton>
        </section>
      </div>
    </form>
    <div class="form-section-button2">
      <PvButton class="p-button p-component" @click="addStudent()">
        Add another student
      </PvButton>
    </div>
    <section class="form-submit">
      <PvButton
        type="submit"
        label="Submit"
        class="submit-button"
        @click="handleFormSubmit(!v$.$invalid)"
      />
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, defineEmits } from "vue";
import { required, minLength, helpers } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";

const props = defineProps({
  isRegistering: { type: Boolean, default: true },
});

console.log(props);
const noActivationCode = ref(false);

const emit = defineEmits(["submit"]);
const state = reactive({
  students: [
    {
      activationCode: "",
      studentUsername: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      middleName: "",
      dob: "",
      grade: "",
      ell: "",
      gender: "",
      freeReducedLunch: "",
      IEPStatus: "",
      race: [],
      hispanicEthnicity: "",
      homeLanguage: [],
    },
  ],
});

const rules = {
  students: {
    $each: helpers.forEach({
      activationCode: { 
        ...(!noActivationCode.value ? {required}: {}),
      },
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
    }),
  },
};

function addStudent() {
  state.students.push({
    activationCode: "",
    studentUsername: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    middleName: "",
    dob: "",
    grade: "",
    ell: "",
    gender: "",
    freeReducedLunch: "",
    IEPStatus: "",
    race: [],
    hispanicEthnicity: "",
    homeLanguage: [],
  });
}

function deleteStudentForm(student) {
  if (state.students.length > 1) {
    state.students.splice(student, 1); // Remove the student at the specified index
  } else {
    alert("At least one student is required."); // Prevent deleting the last student form
  }
}
function isPasswordMismatch(index) {
  return (
    state.students[index]?.password !== state.students[index]?.confirmPassword
  );
}

const submitted = ref(false);

const v$ = useVuelidate(rules, state);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;

  if (!isFormValid) {
    console.log("it is not valid")
    return;
  }
  // format username as an email
  const computedStudents = state.students.map((student) => {
    const { studentUsername, ...studentData } = student;
    return {
      studentUsername: `${studentUsername}@roar-auth.com`,
      ...studentData,
    };
  });
  console.log(computedStudents)
  emit("submit", computedStudents);
};
const yearOnlyCheck = ref(false);

const searchRaces = (event) => {
  const query = event.query.toLowerCase();

  let filteredOptions = races.filter((opt) =>
    opt.toLowerCase().includes(query)
  );

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }

  raceOptions.value = filteredOptions;
};

const searchLanguages = (event) => {
  const query = event.query.toLowerCase();

  let filteredOptions = languages.filter((opt) =>
    opt.toLowerCase().includes(query)
  );

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }

  languageOptions.value = filteredOptions;
};

const gradeOptions = ref([
  { label: "PK", value: "PK" },
  { label: "TK", value: "TK" },
  { label: "K", value: "K" },
  { label: "1st", value: "1" },
  { label: "2nd", value: "2" },
  { label: "3rd", value: "3" },
  { label: "4th", value: "4" },
  { label: "5th", value: "5" },
  { label: "6th", value: "6" },
  { label: "7th", value: "7" },
  { label: "8th", value: "8" },
  { label: "9th", value: "9" },
  { label: "10th", value: "10" },
  { label: "11th", value: "11" },
  { label: "12th", value: "12" },
]);

const genderOptions = ref([
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Nonbinary / Do not want to specify", value: "dns" },
]);

const races = [
  "american Indian or alaska Native",
  "asian",
  "black or african American",
  "native hawaiian or other pacific islander",
  "white",
];

const raceOptions = ref([...races]);

const frlOptions = ref([
  { label: "Free", value: "Free" },
  { label: "Reduced", value: "Reduced" },
  { label: "Paid", value: "Paid" },
  { label: "N/A", value: "N/A" },
]);

const IEPOptions = ref([
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
]);

const ellOptions = ref([
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
]);

const ethnicityOptions = ref([
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
]);

// Top 20 languages spoken in the U.S.
const languages = [
  "English",
  "Spanish",
  "Chinese",
  "Tagalog",
  "Vietnamese",
  "Arabic",
  "French",
  "Korean",
  "Russian",
  "German",
  "Haitian Creole",
  "Hindi",
  "Portuguese",
  "Italian",
  "Polish",
  "Urdu",
  "Japanese",
  "Persian",
  "Gujarati",
  "Telugu",
];

const languageOptions = ref([...languages]);
</script>

<style scoped>
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

.required {
  color: var(--bright-red);
}
.login-title {
  font-size: 26px;
}
.submit-button {
  margin: auto;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  background-color: var(--primary-color);
  color: white;
  border: none;
  width: 11.75rem;
}
.submit-button:hover {
  background-color: #b7b5b5;
  color: black;
}
.terms-checkbox {
  margin-top: 0;
  margin-bottom: 0.75rem;
}
.student-form-border {
  border: 2px solid #ccc; /* Add a border around each student form */
  padding: 20px; /* Add padding for better spacing */
  margin: 5px; /* Add margin for better spacing */
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
