<template>
  <section>
    <h2>Change Your Password</h2>
    <span>Update your password here.</span>
    <div class="flex flex-column">
      <label>New password</label>
      <PvInputText v-model="v$.password.$model" :class="{ 'p-invalid': v$.password.$invalid && submitted }" />
      <small v-if="v$.password.$invalid && submitted" class="p-error"
        >Password must be at least 6 characters long.</small
      >
    </div>
    <div class="flex flex-column">
      <label>Confirm password</label>
      <PvInputText
        v-model="v$.confirmPassword.$model"
        :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }"
      />
      <small v-if="v$.confirmPassword.$invalid && submitted" class="p-error">Passwords do not match.</small>
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { useAuthStore } from '@/store/auth';
import { useToast } from 'primevue/usetoast';
import { storeToRefs } from 'pinia';
import { required, sameAs, minLength } from '@vuelidate/validators';

// +----------------+
// | Initialization |
// +----------------+

// +-----------+
// | Vuelidate |
// +-----------+
const passwordRef = computed(() => state.password);
const rules = {
  password: {
    required,
    minLength: minLength(6),
  },
  confirmPassword: {
    required,
    sameAsPassword: sameAs(passwordRef),
  },
};
const state = reactive({
  password: '',
  confirmPassword: '',
});
const v$ = useVuelidate(rules, state);
const submittingPassword = ref(false);
const submitted = ref(false);

// +----------------------+
// | Submitting functions |
// +----------------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid } = storeToRefs(authStore);

async function updatePassword() {
  submitted.value = true;
  if (!v$.value.$invalid) {
    await roarfirekit.value
      .updateUserData(uid, { password: state.password })
      .then(() => {
        console.log('password updated!');
        toast.add({ severity: 'success', summary: 'Updated', detail: 'Password Updated!', life: 3000 });
      })
      .catch((error) => {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Unable to update password' });
      });
  }
}

// +-------------------+
// | Utility functions |
// +-------------------+

// +-------------------------+
// | Firekit Inititalization |
// +-------------------------+
const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.updateUserData) init();
});

onMounted(() => {
  if (roarfirekit.value.updateUserData) init();
});
</script>
