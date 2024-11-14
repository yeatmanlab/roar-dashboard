<template>
  <div class="card">
    <p class="login-title" align="left">Register for ROAR</p>
    <form class="p-fluid" @submit.prevent="handleFormSubmit(!v$.$invalid)">
      <!--First / Last Name-->
      <div class="mt-4 name-container">
        <div>
          <label for="firstName">First Name</label>
          <PvInputText name="firstName" />
        </div>
        <div>
          <label for="lastName">Last Name</label>
          <PvInputText name="lastName" />
        </div>
      </div>
      <!--Username / Email-->
      <div class="field mt-4">
        <div class="p-input-icon-right">
          <label for="username">Username or Email <span class="required">*</span></label>
          <PvInputText
            v-model="v$.email.$model"
            name="username"
            :class="{ 'p-invalid': v$.email.$invalid && submitted }"
            aria-describedby="email-error"
          />
        </div>
        <span v-if="v$.email.$error && submitted">
          <span v-for="(error, index) of v$.email.$errors" :key="index">
            <small class="p-error">{{ error.$message }}</small>
          </span>
        </span>
        <small v-else-if="(v$.email.$invalid && submitted) || v$.email.$pending.$response" class="p-error">
          {{ v$.email.required.$message.replace('Value', 'Email') }}
        </small>
      </div>
      <!--Age / DOB-->
      <div class="mt-4 mb-5">
        <div class="flex justify-content-between">
          <label>Date of Birth <span class="required">*</span></label>
          <div class="flex align-items-center">
            <PvCheckbox v-model="yearOnlyCheck" :binary="true" name="yearOnly" />
            <label for="yearOnly" class="ml-2">Use Year Only</label>
          </div>
        </div>
        <div v-if="!yearOnlyCheck">
          <PvDatePicker
            v-model="v$.dob.$model"
            view="date"
            date-format="mm/dd/yy"
            model-value="string"
            show-icon
            :class="{ 'p-invalid': v$.dob.$invalid && submitted }"
          />
        </div>
        <div v-else>
          <PvDatePicker
            v-model="v$.dob.$model"
            view="year"
            date-format="yy"
            model-value="string"
            show-icon
            :class="{ 'p-invalid': v$.dob.$invalid && submitted }"
          />
        </div>
        <small v-if="(v$.dob.$invalid && submitted) || v$.dob.$pending.$response" class="p-error">{{
          v$.dob.required.$message.replace('Value', 'Date of Birth')
        }}</small>
      </div>
      <!--Grade-->
      <div class="mt-4 mb-5">
        <label for="grade">Grade <span class="required">*</span></label>
        <PvSelect
          v-model="v$.grade.$model"
          :options="gradeOptions"
          option-label="label"
          option-value="value"
          name="grade"
          :class="{ 'p-invalid': v$.grade.$invalid && submitted }"
        />
        <small v-if="(v$.grade.$invalid && submitted) || v$.grade.$pending.$response" class="p-error">{{
          v$.grade.required.$message.replace('Value', 'Grade')
        }}</small>
      </div>
      <!--English Language Level-->
      <div class="mt-4 mb-5">
        <label for="ell">English Language Level</label>
        <PvSelect v-model="v$.ell.$model" :options="eLLOptions" option-label="label" option-value="value" name="ell" />
      </div>
      <!--Sex-->
      <div class="mt-4 mb-5">
        <label for="sex">Gender</label>
        <PvSelect v-model="v$.sex.$model" :options="sexOptions" option-label="label" option-value="value" name="sex" />
      </div>
      <!--Password-->
      <div class="field mt-4 mb-5">
        <div>
          <label for="password">Password <span class="required">*</span></label>
          <PvPassword
            v-model="v$.password.$model"
            name="password"
            :class="{ 'p-invalid': v$.password.$invalid && submitted }"
            toggle-mask
            feedback
          >
            <template #header>
              <h6>Pick a password</h6>
            </template>
            <template #footer="sp">
              {{ sp.level }}
              <PvDivider />
              <p class="mt-2">Suggestions</p>
              <ul class="pl-2 ml-2 mt-0" style="line-height: 1.5">
                <li>At least one lowercase</li>
                <li>At least one uppercase</li>
                <li>At least one numeric</li>
                <li>Minimum 8 characters</li>
              </ul>
            </template>
          </PvPassword>
        </div>
        <small v-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" class="p-error">
          {{ v$.password.required.$message.replace('Value', 'Password') }}
        </small>
      </div>
      <!--Confirm Password-->
      <div class="field mt-4 mb-5">
        <div>
          <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
          <PvPassword
            :id="`confirmPassword-${isRegistering ? 'register' : 'login'}`"
            v-model="v$.confirmPassword.$model"
            name="confirmPassword"
            :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }"
            toggle-mask
            :feedback="false"
          >
          </PvPassword>
        </div>
        <small
          v-if="(v$.confirmPassword.$invalid && submitted) || v$.confirmPassword.$pending.$response"
          class="p-error"
        >
          Passwords must match
        </small>
      </div>
      <!--Accept Checkbox-->
      <div class="field-checkbox terms-checkbox">
        <PvCheckbox
          :id="`accept-${isRegistering ? 'register' : 'login'}`"
          v-model="v$.accept.$model"
          name="accept"
          value="Accept"
          :class="{ 'p-invalid': v$.accept.$invalid && submitted }"
        />
        <label for="accept" :class="{ 'p-error': v$.accept.$invalid && submitted }"
          >I agree to the terms and conditions</label
        >
      </div>
      <PvButton type="submit" label="Submit" class="submit-button" />
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { required, sameAs } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';

// TODO: Include middle
const state = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  dob: '',
  ell: '',
  sex: '',
  grade: '',
});
const passwordRef = computed(() => state.password);
const rules = {
  firstName: {},
  lastName: {},
  email: { required },
  password: { required },
  confirmPassword: { required, sameAsPassword: sameAs(passwordRef) },
  dob: { required },
  ell: {},
  sex: {},
  grade: { required },
  accept: { required },
};

const submitted = ref(false);

const v$ = useVuelidate(rules, state);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;
  if (!isFormValid) {
    return;
  }
  console.log('to submit:', state);
};

const yearOnlyCheck = ref(false);

// Dropdown Options
const eLLOptions = ref([
  { label: 'English as a First Language', value: 'EFL' },
  { label: 'English as a Second Language', value: 'ESL' },
]);

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

const sexOptions = ref([
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Nonbinary / Do not want to specify', value: 'dns' },
]);
</script>
<style scoped>
.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
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
  margin-top: 0.5rem;
  display: flex;
  background-color: #e5e5e5;
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
