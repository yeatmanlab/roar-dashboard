<template>
  <section id="your-information" class="form-section">
    <h2>Your Information</h2>
    <EditUsersForm
      v-model="userDataModel"
      :user-id="uid"
      :edit-mode="isEditMode"
      @update:user-data="localUserData = $event"
    />
    <div v-if="isAdmin" class="flex">
      <PvButton
        v-if="!isEditMode"
        label="Edit"
        class="border-none border-round bg-primary text-white p-2 hover:surface-400 ml-auto"
        @click="isEditMode = true"
      />
      <div v-else class="ml-auto">
        <PvButton
          label="Cancel"
          class="border-none border-round bg-primary text-white p-2 hover:surface-400 mr-2"
          @click="isEditMode = false"
        />
        <PvButton
          :label="isSubmitting ? '' : 'Update'"
          class="border-none border-round bg-primary text-white p-2 hover:surface-400 ml-auto"
          @click="submitUserData"
          ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"
        /></PvButton>
      </div>
    </div>
  </section>
</template>
<script setup>
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useQuery } from '@tanstack/vue-query';
import { ref, onMounted, computed } from 'vue';
import EditUsersForm from '../EditUsersForm.vue';
import { fetchDocById } from '@/helpers/query/utils';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid } = storeToRefs(authStore);
const localUserData = ref({});
const isEditMode = ref(false);
const isSubmitting = ref(false);

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
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

// +---------+
// | Queries |
// +---------+
const { data: userClaims } = useQuery({
  queryKey: ['userClaims', uid],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Keep track of the user's type
const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});

// +------------+
// | Submission |
// +------------+
async function submitUserData() {
  console.log('Submitting user data', localUserData.value);
  isSubmitting.value = true;

  await roarfirekit.value
    .updateUserData(uid.value, uid.value, localUserData.value)
    .then(() => {
      isEditMode.value = false;
      isSubmitting.value = false;
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Your Info has been updated', life: 3000 });
    })
    .catch((error) => {
      console.log('Error updating user data', error);
      toast.add({
        severity: 'error',
        summary: 'Unexpected Error',
        detail: 'An unexpected error has occurred.',
        life: 3000,
      });
      isEditMode.value = false;
      isSubmitting.value = false;
    });
}
</script>
