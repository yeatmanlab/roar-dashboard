<template>
  <div class="card">
    <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
      <div class="field mt-2">
        <div class="p-input-icon-right">
          <InputText v-model="v$.email.$model"
            :class="{ 'p-invalid': v$.email.$invalid && submitted }" aria-describedby="email-error" placeholder="Your username or email" />
        </div>
        <span v-if="v$.email.$error && submitted">
          <span v-for="(error, index) of v$.email.$errors"
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
          <Password v-model="v$.password.$model"
            :class="{ 'p-invalid': v$.password.$invalid && submitted }" toggleMask :feedback="false" placeholder="Your Password">
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
        <small 
          v-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" 
          class="p-error"
        >
          {{ v$.password.required.$message.replace("Value", "Password")}}
        </small>
      </div>
      <Button type="submit" label="Submit" class="submit-button" />
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, defineEmits } from "vue";
import { required } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";

const emit = defineEmits(['submit'])

const state = reactive({
  email: "",
  password: "",
});
const rules = {
  email: { required },
  password: { required },
};
const submitted = ref(false);
const v$ = useVuelidate(rules, state);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;
  if (!isFormValid) {
    return;
  }
  emit('submit', state)
}

const resetForm = () => {
  state.email = "";
  state.password = "";
  state.accept = null;
  submitted.value = false;
};
</script>
<style scoped>
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
</style>