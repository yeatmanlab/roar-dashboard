<template>
    <div class="card">
      <!-- <p class="login-title" align="left">Register for ROAR</p> -->
      <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
        <!--First / Last Name-->
        <div class="mt-4 name-container">
          <div>
            <label for="firstName">First Name <span class="required">*</span></label>
            <InputText name="firstName" v-model="v$.firstName.$model" :class="{ 'p-invalid': v$.firstName.$invalid && submitted }" aria-describedby="first-name-error"/>
            <span v-if="v$.firstName.$error && submitted">
              <span v-for="(error, index) of v$.firstName.$errors" :key="index">
                <small class="p-error">{{ error.$message }}</small>
              </span>
            </span>
            <small v-else-if="(v$.firstName.$invalid && submitted) || v$.firstName.$pending.$response" class="p-error">
              {{ v$.firstName.required.$message.replace("Value", "First Name") }}
            </small>
          </div>
          <div>
            <label for="lastName">Last Name <span class="required">*</span></label>
            <InputText name="lastName" v-model="v$.lastName.$model" :class="{ 'p-invalid': v$.firstName.$invalid && submitted }" aria-describedby="first-name-error"/>
            <span v-if="v$.lastName.$error && submitted">
              <span v-for="(error, index) of v$.lastName.$errors" :key="index">
                <small class="p-error">{{ error.$message }}</small>
              </span>
            </span>
            <small v-else-if="(v$.lastName.$invalid && submitted) || v$.lastName.$pending.$response" class="p-error">
              {{ v$.lastName.required.$message.replace("Value", "Last Name") }}
            </small>
          </div>  
        </div>
        <!-- Age / DOB -->
        <div class="mt-4 mb-5">
          <div class="flex justify-content-between">
            <label>Date of Birth <span class="required">*</span></label>
            <div class="flex align-items-center">
              <Checkbox v-model="yearOnlyCheck" :binary="true" name="yearOnly" />
              <label for="yearOnly" class="ml-2">Use Year Only</label>
            </div>
          </div>
          <div v-if="!yearOnlyCheck">
            <Calendar v-model="v$.dob.$model" view="date" dateFormat="mm/dd/yy" modelValue="string" showIcon :class="{ 'p-invalid': v$.dob.$invalid && submitted }"/>
          </div>
          <div v-else>
            <Calendar v-model="v$.dob.$model" view="year" dateFormat="yy" modelValue="string" showIcon :class="{ 'p-invalid': v$.dob.$invalid && submitted }" />
          </div>
          <small v-if="(v$.dob.$invalid && submitted) || v$.dob.$pending.$response" class="p-error">{{ v$.dob.required.$message.replace("Value", "Date of Birth") }}</small>
        </div>
        <!--Grade-->
        <div class="mt-4 mb-5">
          <label for="grade">Grade <span class="required">*</span></label>
          <Dropdown 
            v-model="v$.grade.$model" 
            :options="gradeOptions" 
            optionLabel="label" 
            optionValue="value" 
            name="grade"
            :class="{ 'p-invalid': v$.grade.$invalid && submitted }"
          />
          <small v-if="(v$.grade.$invalid && submitted) || v$.grade.$pending.$response" class="p-error">{{ v$.grade.required.$message.replace("Value", "Grade") }}</small>
        </div>
        <!--English Language Level-->
        <div class="mt-4 mb-5">
          <label for="ell">English Language Level</label>
          <Dropdown v-model="v$.ell.$model" :options="eLLOptions" optionLabel="label" optionValue="value" name="ell"/>
        </div>
        <!--Sex-->
        <div class="mt-4 mb-5">
          <label for="sex">Gender</label>
          <Dropdown :options="sexOptions" optionLabel="label" optionValue="value" v-model="v$.sex.$model" name="sex" />
        </div>
        <Button type="submit" label="Next" class="submit-button"/>
      </form>
    </div>
  </template>
  
  <script setup>
  import { computed, reactive, ref, toRaw, watch } from "vue";
  import { required, sameAs, minLength, } from "@vuelidate/validators";
  import { useVuelidate } from "@vuelidate/core";
  
  
  const props = defineProps({
    isRegistering: {type: Boolean, default: true}
  });
  
  // TODO: Include middle
  const state = reactive({
    activationCode: "",
    firstName: "",
    lastName: "",
    usernameOrEmail: "",
    password: "",
    confirmPassword: "",
    accept: [],
    dob: "",
    ell: "",
    sex: "",
    grade: ""
  });
  const passwordRef = computed(() => state.password);
  
  
  const isChecked = (value) => {
    return value.includes('Accept');
  };
  
  const rules = {
    firstName: { required },
    lastName: { required },
    usernameOrEmail: { 
      required, 
    },
    password: { 
      required,
      minLength: minLength(6),
    },
    confirmPassword: { required, sameAsPassword: sameAs(passwordRef) }, 
    accept: { sameAs: isChecked },
    dob: { required },
    ell: { required },
    sex: { required },
    grade: { required }
  };

  watch(() => state.dob, (val) => console.log('dob: ', typeof toRaw(val)))
  
  
  const submitted = ref(false);
  
  const v$ = useVuelidate(rules, state);
  
  const handleFormSubmit = (isFormValid) => {
    submitted.value = true
    if (!isFormValid) {
      return;
    }

    resetForm()
    // authStore.registerWithEmailAndPassword(state);
  };
  
  const resetForm = () => {
    state.firstName = "";
    state.lastName = "";
    state.email = "";
    state.password = "";
    state.confirmPassword = "";
    state.dob = "";
    state.ell = "";
    state.sex = "";
    state.grade = "";
    submitted.value = false;
    yearOnlyCheck.value = false;
  };
  const yearOnlyCheck = ref(false);
  
//   Dropdown Options
  const eLLOptions = ref([
    {label: 'English as a First Language', value: 'EFL'},
    {label: 'English as a Second Language', value: 'ESL'}
  ]);
  
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
  
  const sexOptions = ref([
    {label: 'Male', value: 'male'},
    {label: 'Female', value: 'female'},
    {label: 'Nonbinary / Do not want to specify', value: 'dns'}
  ]);
  </script>
  
  <style scoped>
  .stepper {
    margin: 2rem 0rem;
  }
  
  .name-container {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }
  .required {
    color: red;
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
  </style>