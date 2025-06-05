<template>
  <h2>{{ hasPassword ? 'Change Your Password' : 'Add a Password' }}</h2>

  <div class="flex gap-1 flex-column">
    <label>New password</label>
    <PvPassword
      v-model="v$.password.$model"
      :class="{ 'p-invalid': v$.password.$invalid && submitted }"
      :inputProps="{ autocomplete: 'new-password' }"
      show-icon="pi pi-eye-slash"
      hide-icon="pi pi-eye"
      toggle-mask
    />
    <small v-if="v$.password.$invalid && submitted" class="p-error">Password must be at least 6 characters long.</small>
  </div>

  <div class="flex gap-1 mt-3 flex-column">
    <label>Confirm password</label>
    <PvPassword
      v-model="v$.confirmPassword.$model"
      :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }"
      :inputProps="{ autocomplete: 'new-password' }"
      :feedback="false"
      show-icon="pi pi-eye-slash"
      hide-icon="pi pi-eye"
      toggle-mask
    />
    <small v-if="v$.confirmPassword.$invalid && submitted" class="p-error">Passwords do not match.</small>
  </div>

  <div class="flex mt-3">
    <PvButton
      :label="hasPassword ? 'Update Password' : 'Submit Password'"
      class="p-2 ml-auto text-white border-none border-round bg-primary hover:surface-400"
      @click="updatePassword"
    >
      <i v-if="isSubmitting" class="pi pi-spinner pi-spin" />
    </PvButton>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { useAuthStore } from '@/store/auth';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvPassword from 'primevue/password';
import { storeToRefs } from 'pinia';
import { required, sameAs, minLength } from '@vuelidate/validators';
// +-------------------+
// | Vuelidate / Setup |
// +-------------------+
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
const submitted = ref(false);
const isSubmitting = ref(false);

// +----------------------+
// | Submitting functions |
// +----------------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid } = storeToRefs(authStore);

const providerIds = computed(() => {
  const providerData = roarfirekit.value?.admin?.user?.providerData;
  return providerData.map((provider) => {
    return provider.providerId;
  });
});

const hasPassword = computed(() => {
  return providerIds.value.includes('password');
});

async function updatePassword() {
  submitted.value = true;
  if (!v$.value.$invalid) {
    isSubmitting.value = true;
    await roarfirekit.value
      .updateUserData(uid.value, { password: state.password })
      .then(() => {
        submitted.value = false;
        isSubmitting.value = false;
        state.password = '';
        state.confirmPassword = '';
        toast.add({ severity: 'success', summary: 'Updated', detail: 'Password Updated!', life: 3000 });
      })
      .catch(() => {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Unable to update password' });
      });
  }
}

// +------------------------+
// | Firekit initialization |
// +------------------------+
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
