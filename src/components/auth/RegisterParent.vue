<template>
  <div class="card">
    <p class="login-title" align="left">Register for ROAR</p>
    <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
      <!-- Activation Code -->
      <div class="field mt-4">
        <div class="p-input-icon-right">
          <label for="activationCode">Activation code <span class="required">*</span></label>
          <InputText
            v-model="v$.activationCode.$model"
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
      </div>
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
      <!--Username / Email-->
      <div class="field mt-4">
        <div class="p-input-icon-right">
          <label for="usernameOrEmail">Username or Email <span class="required">*</span></label>
          <InputText
            v-model="v$.usernameOrEmail.$model" 
            name="usernameOrEmail"
            :class="{ 'p-invalid': v$.usernameOrEmail.$invalid && submitted }" 
            aria-describedby="username-or-email-error"
          />
        </div>
        <span v-if="v$.usernameOrEmail.$error && submitted">
          <small class="p-error">Please enter a valid email address.</small>
        </span>
        <small v-else-if="(v$.usernameOrEmail.$invalid && submitted) || v$.usernameOrEmail.$pending.$response" class="p-error">
          {{ v$.usernameOrEmail.required.$message.replace("Value", "Username or Email") }}
        </small>
      </div>
      <!--Password-->
      <div class="field mt-4 mb-5">
        <div>
          <label for="password">Password <span class="required">*</span></label>
          <Password v-model="v$.password.$model" name="password" :class="{ 'p-invalid': v$.password.$invalid && submitted }" toggleMask show-icon="pi pi-eye-slash" hide-icon="pi pi-eye" :feedback="false"></Password>
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
      <div class="field mt-4 mb-5">
        <div>
          <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
          <Password :id="`confirmPassword-${isRegistering ? 'register' : 'login'}`" v-model="v$.confirmPassword.$model" name="confirmPassword"
            :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }" toggleMask show-icon="pi pi-eye-slash" hide-icon="pi pi-eye" :feedback="false">
          </Password>
        </div>
        <small v-if="(v$.confirmPassword.$invalid && submitted) || v$.confirmPassword.$pending.$response" class="p-error">
          Passwords must match
        </small>
      </div>
      <!--Accept Checkbox-->
      <div class="mt-4 mb-5">
        <div class="field-checkbox terms-checkbox">
          <Checkbox :id="`accept-${isRegistering ? 'register' : 'login'}`" name="accept" value="Accept"
            v-model="v$.accept.$model" :class="{ 'p-invalid': v$.accept.$invalid && submitted }" />
          <label for="accept" :class="{ 'p-error': v$.accept.$invalid && submitted }">I agree to the terms and conditions <span class="required">*</span></label>
        </div>
        <small v-if="(v$.accept.$invalid && submitted) || v$.accept.$pending.$response" class="p-error">
            You must agree to the terms and conditions
        </small>
      </div>
      <Button type="submit" label="Submit" class="submit-button" />
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, toRaw, watch } from "vue";
import { required, sameAs, minLength, } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";

const router = useRouter()

const props = defineProps({
  isRegistering: {type: Boolean, default: true}
});

const state = reactive({
  activationCode: "",
  firstName: "",
  lastName: "",
  password: "",
  confirmPassword: "",
  accept: [],
});
const passwordRef = computed(() => state.password);


const isUsernameOrEmail = (value) => {
  if (!value.includes('@')) return true;

  const emailRegex = /^(?!.*@.*@)[a-zA-Z0-9]+([._]?[a-zA-Z0-9]+)*(@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,7})+)?$/;
  return emailRegex.test(value);
} 

const isChecked = (value) => {
  return value.includes('Accept');
};

const rules = {
  activationCode: { required },
  firstName: { required },
  lastName: { required },
  usernameOrEmail: { 
    required, 
    isUsernameOrEmail
  },
  password: { 
    required,
    minLength: minLength(6),
  },
  confirmPassword: { required, sameAsPassword: sameAs(passwordRef) }, 
  accept: { sameAs: isChecked },
};


const submitted = ref(false);

const v$ = useVuelidate(rules, state);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true
  if (!isFormValid) {
    return;
  }

  resetForm()

  router.push('/register/student')
  // authStore.registerWithEmailAndPassword(state);
};

const resetForm = () => {
  state.firstName = "";
  state.lastName = "";
  state.email = "";
  state.password = "";
  state.confirmPassword = "";
  submitted.value = false;
};

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