<template>
  <div class="card">
    <p class="login-title" align="left">{{ `${isRegistering ? 'Register for' : 'Log In to'} ROAR` }}</p>
    <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
      <div class="field mt-4">
        <div class="p-input-icon-right">
          <InputText :id="`email-${isRegistering ? 'register' : 'login'}`" v-model="v$.email.$model"
            :class="{ 'p-invalid': v$.email.$invalid && submitted }" aria-describedby="email-error" placeholder="Your username or email" />
        </div>
        <span v-if="v$.email.$error && submitted">
          <span :id="`email-error-${isRegistering ? 'register' : 'login'}`" v-for="(error, index) of v$.email.$errors"
            :key="index">
            <small class="p-error">{{ error.$message }}</small>
          </span>
        </span>
        <small v-else-if="
          (v$.email.$invalid && submitted) || v$.email.$pending.$response
        " class="p-error">{{ v$.email.required.$message.replace("Value", "Email") }}</small>
      </div>
      <div class="field mt-4 mb-5">
        <div>
          <Password :id="`password-${isRegistering ? 'register' : 'login'}`" v-model="v$.password.$model"
            :class="{ 'p-invalid': v$.password.$invalid && submitted }" toggleMask :feedback="isRegistering" placeholder="Your Password">
            <template #header>
              <h6>Pick a password</h6>
            </template>
            <template #footer="sp">
              {{ sp.level }}
              <Divider />
              <p class="mt-2">Suggestions</p>
              <ul class="pl-2 ml-2 mt-0" style="line-height: 1.5">
                <li>At least one lowercase</li>
                <li>At least one uppercase</li>
                <li>At least one numeric</li>
                <li>Minimum 8 characters</li>
              </ul>
            </template>
          </Password>
        </div>
        <small v-if="
          (v$.password.$invalid && submitted) ||
          v$.password.$pending.$response
        " class="p-error">{{
  v$.password.required.$message.replace("Value", "Password")
}}</small>
      </div>
      <div v-if="isRegistering" class="field-checkbox terms-checkbox">
        <Checkbox :id="`accept-${isRegistering ? 'register' : 'login'}`" name="accept" value="Accept"
          v-model="v$.accept.$model" :class="{ 'p-invalid': v$.accept.$invalid && submitted }" />
        <label for="accept" :class="{ 'p-error': v$.accept.$invalid && submitted }">I agree to the terms and
          conditions</label>
      </div>
      <Button type="submit" label="Submit" class="submit-button" />
    </form>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { required } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";

const props = defineProps({
  isRegistering: {type: Boolean, default: true}
})
const authStore = useAuthStore();

const state = reactive({
  email: "",
  password: "",
  accept: null,
});

const rules = {
  email: { required },
  password: { required },
  accept: { required },
};

const submitted = ref(false);

const v$ = useVuelidate(rules, state);

const authWithGoogle = () => {
  if (isMobileBrowser()) {
    authStore.signInWithGoogleRedirect();
  } else {
    authStore.signInWithGooglePopup();
  }
};

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;
  if (!isFormValid) {
    return;
  }
  authStore.logInWithEmailAndPassword(state);
}

const resetForm = () => {
  state.email = "";
  state.password = "";
  state.accept = null;
  submitted.value = false;
};
</script>
<style scoped>
.login-title {
  font-size: 26px;
}
.submit-button {
  margin-top: .5rem;
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