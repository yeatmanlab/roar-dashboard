<template>
  <section id="your-information" class="form-section">
    <h2>Your Information</h2>
    <EditUsersForm :user-data="userData" v-model="userDataModel" @update:userData="localUserData = $event" />
    <div class="flex">
      <PvButton
        v-if="!isEditMode"
        @click="isEditMode = true"
        label="Edit"
        class="border-none border-round bg-primary text-white p-2 hover:surface-400 ml-auto"
      />
      <PvButton
        v-else
        @click="submitUserData"
        label="Update"
        class="border-none border-round bg-primary text-white p-2 hover:surface-400 ml-auto"
      />
    </div>
  </section>
</template>
<script setup>
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useQuery } from '@tanstack/vue-query';
import { ref, onMounted } from 'vue';
import EditUsersForm from '../EditUsersForm.vue';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid } = storeToRefs(authStore);
const localUserData = ref({});
const isEditMode = ref(false);

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
const { data: userData } = useQuery({
  queryKey: ['userData', uid],
  queryFn: () => fetchDocById('users', uid.value),
  keepPrevousData: true,
  enabled: initialized,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// +------------+
// | Submission |
// +------------+
async function submitUserData() {
  console.log('Submitting user data', localUserData.value);
}
</script>
