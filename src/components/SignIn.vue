<template>
  <div class="card">
    <b class="text-center mt-3 mb-1">
      {{ `${isRegistering ? "Register" : "Log in"} with email and password` }}
    </b>
    <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
      <div class="field mt-4">
        <div class="p-float-label p-input-icon-right">
          <i class="pi pi-envelope" />
          <InputText
            :id="`email-${isRegistering ? 'register' : 'login'}`"
            v-model="v$.email.$model"
            :class="{ 'p-invalid': v$.email.$invalid && submitted }"
            aria-describedby="email-error"
          />
          <label
            for="email"
            :class="{ 'p-error': v$.email.$invalid && submitted }"
            >Email*</label
          >
        </div>
        <span v-if="v$.email.$error && submitted">
          <span
            :id="`email-error-${isRegistering ? 'register' : 'login'}`"
            v-for="(error, index) of v$.email.$errors"
            :key="index"
          >
            <small class="p-error">{{ error.$message }}</small>
          </span>
        </span>
        <small
          v-else-if="
            (v$.email.$invalid && submitted) || v$.email.$pending.$response
          "
          class="p-error"
          >{{ v$.email.required.$message.replace("Value", "Email") }}</small
        >
      </div>
      <div class="field mt-4">
        <div class="p-float-label">
          <Password
            :id="`password-${isRegistering ? 'register' : 'login'}`"
            v-model="v$.password.$model"
            :class="{ 'p-invalid': v$.password.$invalid && submitted }"
            toggleMask
          >
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
          <label
            for="password"
            :class="{ 'p-error': v$.password.$invalid && submitted }"
            >Password*</label
          >
        </div>
        <small
          v-if="
            (v$.password.$invalid && submitted) ||
            v$.password.$pending.$response
          "
          class="p-error"
          >{{
            v$.password.required.$message.replace("Value", "Password")
          }}</small
        >
      </div>
      <div class="field-checkbox">
        <Checkbox
          :id="`accept-${isRegistering ? 'register' : 'login'}`"
          name="accept"
          value="Accept"
          v-model="v$.accept.$model"
          :class="{ 'p-invalid': v$.accept.$invalid && submitted }"
        />
        <label
          for="accept"
          :class="{ 'p-error': v$.accept.$invalid && submitted }"
          >I agree to the terms and conditions*</label
        >
      </div>
      <Button type="submit" label="Submit" class="mt-2" />
    </form>

    <Divider align="center" type="dashed"> <b>or</b> </Divider>

    <div class="push-top text-center">
      <Button
        icon="pi pi-google"
        @click="authWithGoogle"
        :label="`${isRegistering ? 'Register' : 'Sign in'} with Google`"
      />
    </div>
  </div>
</template>

<script>
import { reactive, ref } from "vue";
import { email, required } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { useAuthStore } from "@/store/auth";
import { isMobileBrowser } from "@/helpers";

export default {
  props: {
    isRegistering: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const authStore = useAuthStore();

    const state = reactive({
      email: "",
      password: "",
      accept: null,
    });

    const rules = {
      email: { required, email },
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

      if (props.isRegistering) {
        authStore.registerWithEmailAndPassword(state.email, state.password);
      } else {
        authStore.logInWithEmailAndPassword(state.email, state.password);
      }
    };

    const resetForm = () => {
      state.email = "";
      state.password = "";
      state.accept = null;
      submitted.value = false;
    };

    return {
      state,
      v$,
      handleFormSubmit,
      submitted,
      authWithGoogle,
    };
  },
};
</script>
