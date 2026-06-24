<template>
  <section id="your-information" class="form-section">
    <h2>Your Information</h2>
    <EditUsersForm
      v-model="userDataModel"
      :user-data="userData"
      :edit-mode="isEditMode"
      @update:user-data="localUserData = $event"
    />
    <div v-if="userType === 'admin'" class="flex">
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
import { ref, onMounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import _get from 'lodash/get';
import { useAuthStore } from '@/store/auth';
import useUserProfileQuery from '@/composables/queries/useUserProfileQuery';
import useUpdateUserMutation from '@/composables/mutations/useUpdateUserMutation';
import { mapUserFormToUpdateBody } from '@/helpers/mappers/mapUserFormToUpdateBody';
import EditUsersForm from '../EditUsersForm.vue';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, roarUid } = storeToRefs(authStore);
const localUserData = ref({});
const isEditMode = ref(false);
const isSubmitting = ref(false);
const userType = computed(() => {
  return _get(userData.value, 'userType', 'student');
});

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
  if (state.roarfirekit.restConfig?.()) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig?.()) init();
});

// +---------+
// | Queries |
// +---------+
// Reads the current user from the API (`GET /v1/users/:id`). The `restConfig`
// readiness gate (above) still drives `initialized`; the query additionally
// self-gates on the access token, so it won't fire before auth is ready.
const { data: userData } = useUserProfileQuery(roarUid, {
  enabled: initialized,
});

// +------------+
// | Mutations  |
// +------------+
const { mutateAsync: updateUser } = useUpdateUserMutation();

// +------------+
// | Submission |
// +------------+
async function submitUserData() {
  isSubmitting.value = true;

  try {
    // Map the form's nested model to the flat `UpdateUserRequestBodySchema`
    // body before writing, so the read and write stay on the same API source.
    const body = mapUserFormToUpdateBody(localUserData.value);
    await updateUser({ userId: roarUid.value, userData: body });
    isEditMode.value = false;
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Your Info has been updated', life: 3000 });
  } catch (error) {
    console.log('Error updating user data', error);
    toast.add({
      severity: 'error',
      summary: 'Unexpected Error',
      detail: 'An unexpected error has occurred.',
      life: 3000,
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>
