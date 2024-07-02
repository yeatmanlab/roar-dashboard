<template>
  <section>
    <h2>Change Your Password</h2>
    <span>Update your password here.</span>
    <div class="flex flex-column">
      <label>New password</label>
      <!-- <PvInputText v-model="v$.password.modal" /> -->
    </div>
    <div class="flex flex-column">
      <label>Confirm password</label>
      <!-- <PvInputText v-model="v$.confirmPassword.modal" /> -->
    </div>
    <PvButton @click="updatePassword" label="Update Password" />
  </section>
  <section>
    <h2>Link Accounts</h2>
    <span>Make logging in easy by linking your accounts.</span>
    <div class="button-container">
      <PvButton>Log in with Clever</PvButton>
      <PvButton>Log in with Google</PvButton>
      <PvButton>Log in with ClassLink</PvButton>
    </div>
  </section>
</template>
<script setup>
import { ref, reactive } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { required } from '@vuelidate/validators';

// +-----------+
// | Vuelidate |
// +-----------+
const v$ = useVuelidate();
const rules = {
  password: {
    required,
  },
  confirmPassword: {
    required,
  },
};
const state = reactive({
  password: '',
  confirmPassword: '',
});
const submittingPassword = ref(false);
// const invalid = v$.$invalid;

// +----------------------+
// | Submitting functions |
// +----------------------+
function updatePassword() {
  // submittingPassword.value = true;
}

// +-------------------+
// | Utility functions |
// +-------------------+
</script>
