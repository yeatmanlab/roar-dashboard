<template>
  <div class="card">
    <!-- <p class="login-title" align="left">Register for ROAR</p> -->
    <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
      <div v-for="(student, index) in state.students" :key="index" class="student-form-border">
      <!-- Student Username -->
      <section class="form-section">
        <div class="p-input-icon-right">
          <label for="activationCode">Activation code <span class="required">*</span></label>
          <InputText
            v-model="student.activationCode"
            name="activationCode"
            :class="{ 'p-invalid': v$.activationCode.$invalid && submitted }" 
            aria-describedby="activation-code-error"
          />
        </div>
        <span v-if="v$.activationCode.$error && submitted">
          <span v-for="(error, index) of v$.activationCode.$errors" :key="index">
            <small class="p-error">{{ error.$message }}</small>
          </span>
        </span>
        <small v-else-if="(v$.activationCode.$invalid && submitted) || v$.activationCode.$pending.$response" class="p-error">
          {{ v$.activationCode.required.$message.replace("Value", "Activation Code") }}
        </small>
      </section>
      <section class="form-section">
        <div class="p-input-icon-right">
          <label for="studentUsername">Student Username <span class="required">*</span></label>
          <InputText
          v-model="student.studentUsername"
          name="studentUsername"
          :class="{ 'p-invalid': v$.studentUsername.$invalid && submitted }" 
          aria-describedby="username-or-email-error"
          />
        </div>
        <span v-if="v$.studentUsername.$error && submitted">
        <small class="p-error">Please enter a valid email address.</small>
        </span>
        <small v-else-if="(v$.studentUsername.$invalid && submitted) || v$.studentUsername.$pending.$response" class="p-error">
        {{ v$.studentUsername.required.$message.replace("Value", "Username") }}
        </small>
      </section>
       <!--Password-->
      <section class="form-section">
        <div>
          <div>
            <label for="password">Password <span class="required">*</span></label>
            <Password v-model="student.password" name="password" :class="{ 'p-invalid': v$.password.$invalid && submitted }" toggleMask show-icon="pi pi-eye-slash" hide-icon="pi pi-eye" :feedback="false"></Password>
          </div>
          <span v-if="v$.password.$error && submitted">
            <span v-for="(error, index) of v$.password.$errors" :key="index">
              <small class="p-error">{{ error.$message }}</small>
            </span>
          </span>
          <small v-else-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" class="p-error">
            {{ v$.password.required.$message.replace("Value", "Password") }}
          </small>
        </div>
        <!--Confirm Password-->
        <div>
          <div>
          <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
          <Password :id="`confirmPassword-${isRegistering ? 'register' : 'login'}`" v-model="student.confirmPassword" name="confirmPassword"
            :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }" toggleMask show-icon="pi pi-eye-slash" hide-icon="pi pi-eye" :feedback="false">
          </Password>
          </div>
          <small v-if="(v$.confirmPassword.$invalid && submitted) || v$.confirmPassword.$pending.$response" class="p-error">
          Passwords must match
          </small>
        </div>
      </section>
      <section class="form-section">
        <div>
          <!-- Age / DOB -->
          <div class="flex justify-content-between">
            <label>Date of Birth <span class="required">*</span></label>
            <div class="flex align-items-center">
              <Checkbox v-model="yearOnlyCheck" :binary="true" name="yearOnly" />
              <label for="yearOnly" class="ml-2">Use Year Only</label>
            </div>
          </div>
          <div v-if="!yearOnlyCheck">
          <Calendar v-model="student.dob" view="date" dateFormat="mm/dd/yy" modelValue="string" showIcon :class="{ 'p-invalid': v$.dob.$invalid && submitted }"/>
          </div>
          <div v-else>
          <Calendar v-model="student.dob" view="year" dateFormat="yy" modelValue="string" showIcon :class="{ 'p-invalid': v$.dob.$invalid && submitted }" />
          </div>
          <small v-if="(v$.dob.$invalid && submitted) || v$.dob.$pending.$response" class="p-error">{{ v$.dob.required.$message.replace("Value", "Date of Birth") }}</small>
        </div>
      </section>
      <section class="form-section">
        <!--Grade-->
        <div>
          <label for="grade">Grade <span class="required">*</span></label>
          <Dropdown 
          v-model="student.grade" 
          :options="gradeOptions" 
          optionLabel="label" 
          optionValue="value" 
          name="grade"
          :class="{ 'p-invalid': v$.grade.$invalid && submitted }"
          />
          <small v-if="(v$.grade.$invalid && submitted) || v$.grade.$pending.$response" class="p-error">{{ v$.grade.required.$message.replace("Value", "Grade") }}</small>
        </div>
      </section>
      <Accordion>
        <AccordionTab header="Optional Info">
        <!--First / Last Name-->
        <section class="form-section">
            <div>
              <label for="firstName">First Name </label>
              <InputText name="firstName" v-model="student.firstName" :class="{ 'p-invalid': v$.firstName.$invalid && submitted }" aria-describedby="first-name-error"/>
            </div>
            <!-- Middle Name -->
            <div>
              <label for="middleName">Middle Name </label>
              <InputText 
              v-model="student.middleName"
              name="middleName"
              :class="{ 'p-invalid': v$.middleName.$invalid && submitted }"
              />
            </div>
        </section>
        <section class="form-section">
          <div>
            <label for="lastName">Last Name </label>
            <InputText name="lastName" v-model="student.lastName" :class="{ 'p-invalid': v$.firstName.$invalid && submitted }" aria-describedby="first-name-error"/>
          </div>  
        </section>
        <section class="form-section">
          <!--English Language Level-->
          <div class="mt-4 mb-5">
            <label for="ell">English as a Second Language</label>
            <Dropdown v-model="student.ell" :options="ellOptions" optionLabel="label" optionValue="value" name="ell"/>
          </div>
          <!--Sex-->
          <div class="mt-4 mb-5">
            <label for="sex">Gender </label>
            <Dropdown :options="genderOptions" optionLabel="label" optionValue="value" v-model="student.gender" name="gender" />
          </div>
        </section>
        <section class="form-section">
          <!-- Free-Reduced Lunch -->
          <div class="mt-4 mb-5">
            <label for="stateId">Free-Reduced Lunch </label>
            <Dropdown :options="frlOptions" optionLabel="label" optionValue="value" v-model="student.freeReducedLunch" name="freeReducedLunch" />              
          </div>
          <!-- IEP Status -->
          <div class="mt-4 mb-5">
            <label for="stateId">IEP Status</label>
            <Dropdown :options="IEPOptions" optionLabel="label" optionValue="value" v-model="student.IEPStatus" name="IEPStatus" />              
          </div>
        </section>
        <section class="form-section">
          <!-- Race -->
          <div class="mt-4 mb-5">
            <label for="race">Race </label>
            <AutoComplete v-model="student.race" multiple :suggestions="raceOptions" @complete="searchRaces" name="race"/>
          </div>
          <!-- Hispanic Ethinicity -->
          <div class="mt-4 mb-5">
            <label for="hispanicEthnicity">Hispanic or Latino Ethnicity </label>
            <Dropdown :options="ethnicityOptions" optionLabel="label" optionValue="value" v-model="student.hispanicEthnicity" name="hispanicEthinicity" />
          </div>
        </section>
        <section class="form-section">
          <!-- Home Language -->
          <div class="mt-4 mb-5">
            <label for="stateId">Home Language </label>
            <AutoComplete v-model="student.homeLanguage" multiple :suggestions="languageOptions" @complete="searchLanguages" name="homeLanguage"/>
          </div>
        </section>
        </AccordionTab>
      </Accordion>
      <section class="form-section-button">
        <button v-if="index !==0" @click="deleteStudentForm(index)" class="p-button p-component">Delete Student</button>
      </section>
    </div>
    
      </form>
      <div class="form-section-button2">
        <button @click="addStudent()" class="p-button p-component">Add a Student</button>
      </div>
  </div>
  </template>
  
  <script setup>
  import { computed, reactive, ref, toRaw, watch } from "vue";
  import { required, sameAs, minLength, } from "@vuelidate/validators";
  import { useVuelidate } from "@vuelidate/core";
  // import {RegisterStudentSingle} from "../auth/RegisterStudentSingle.vue"
  
  
  const props = defineProps({
  isRegistering: {type: Boolean, default: true}
  });
  // const students = ref([{}]);
  const state = reactive({
    students:[{
      activationCode:"",
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
      freeReducedLunch: "" ,
      IEPStatus: "",
      race: [],
      hispanicEthnicity: "",
      homeLanguage: [],
    }],
  });
  const passwordRef = computed(() => state.password);
  
  const rules = {
  activationCode: {required},
  studentUsername: { required, },
  password: { required, minLength: minLength(6),},
  confirmPassword: { required, sameAsPassword: sameAs(passwordRef) }, 
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
  };
  
  // const rules={};
  
  function addStudent(){
    console.log("adding new student ", state)
    state.students.push({
      activationCode:"",
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
      freeReducedLunch: "" ,
      IEPStatus: "",
      race: [],
      hispanicEthnicity: "",
      homeLanguage: [],    
    });
  }

  function deleteStudentForm(index) {
    if (state.students.length > 1) {
      state.students.splice(index, 1); // Remove the student at the specified index
    } else {
      alert("At least one student is required."); // Prevent deleting the last student form
    }
  }

  const submitted = ref(false);
  
  const v$ = useVuelidate(rules, state);
  
  const handleFormSubmit = (isFormValid) => {
  submitted.value = true
  if (!isFormValid) {
    return;
  }
  resetForm()

  // signup logic
  };
  
  const resetForm = () => {
  state.activationCode="",
  state.firstName = "";
  state.lastName = "";
  state.middleName;
  state.password = "";
  state.confirmPassword = "";
  state.dob = "";
  state.grade = "";
  state.ell = "";
  state.gender = "";
  state.freeReducedLunch = "";
  state.IEPStatus = "";
  state.race = [];
  state.hispanicEthnicity = "";
  state.homeLanguage = [];
  submitted.value = false;
  yearOnlyCheck.value = false;
  };
  const yearOnlyCheck = ref(false);


  const searchRaces = (event) => {
  const query = event.query.toLowerCase();

  let filteredOptions = races.filter(opt => opt.toLowerCase().includes(query));

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map(opt => opt);
  }

  raceOptions.value = filteredOptions;
  }

  const searchLanguages = (event) => {
  const query = event.query.toLowerCase();

  let filteredOptions = languages.filter(opt => opt.toLowerCase().includes(query));

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map(opt => opt);
  }

  languageOptions.value = filteredOptions;
  }

  
  const gradeOptions = ref([
  {label: 'PK', value: 'PK'},
  {label: 'TK', value: 'TK'},
  {label: 'K', value: 'K'},
  {label: '1st', value: '1'},
  {label: '2nd', value: '2'},
  {label: '3rd', value: '3'},
  {label: '4th', value: '4'},
  {label: '5th', value: '5'},
  {label: '6th', value: '6'},
  {label: '7th', value: '7'},
  {label: '8th', value: '8'},
  {label: '9th', value: '9'},
  {label: '10th', value: '10'},
  {label: '11th', value: '11'},
  {label: '12th', value: '12'},
  ]);
  
  const genderOptions = ref([
  {label: 'Male', value: 'male'},
  {label: 'Female', value: 'female'},
  {label: 'Nonbinary / Do not want to specify', value: 'dns'}
  ]);

  const races = [
  'american Indian or alaska Native',
  'asian',
  'black or african American',
  'native hawaiian or other pacific islander',
  'white',
  ]

  const raceOptions = ref([...races]);

  const frlOptions = ref([
  {label: 'Free', value: 'Free'},
  {label: 'Reduced', value: 'Reduced'},
  {label: 'Paid', value: 'Paid'},
  {label: "N/A", value: "N/A"}
  ])

  const IEPOptions = ref([
  {label: 'Yes', value: 'Y' },
  {label: 'No', value: 'N' },
  ])

  const ellOptions = ref([
  {label: 'Yes', value: 'Y'},
  {label: "No", value: "N"},
  ])

  const ethnicityOptions = ref([
  {label: 'Yes', value: 'Y'},
  {label: 'No', value: 'N'}
  ])


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
    'Telugu'
  ]
  
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
  }
  
  .required {
    color: var(--bright-red);
  }
  .login-title {
    font-size: 26px;
  }
  .submit-button {
    margin: auto;
    margin-top: .5rem;
    margin-bottom: .5rem;
    display: flex;
    background-color: #E5E5E5;
    color: black;
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
  margin: 5px;/* Add margin for better spacing */
  } 
  .form-section-button{
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .form-section-button2{
    display: flex;
    align-items: center;
    justify-content: left;
    padding-left: 20px;
    margin-left: 10px;
  }
  .form-section-button2 .p-button{
    width: 50%;
  }
</style>