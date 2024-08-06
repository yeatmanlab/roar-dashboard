<template>
  <div class="flex flex-column mb-3 gap-2">
    <div class="font-bold text-2xl">Offline Mode</div>
    <div class="text-sm font-light">Offline Mode caches data on your device and stores run data locally.</div>
  </div>
  <div v-if="isLoadingUserData" class="flex flex-column align-items-center justify-content-center">
    <AppSpinner />
    <div>Loading User Data</div>
  </div>
  <div v-else>
    <div class="flex flex-row flex-wrap justify-content-between bg-gray-100 px-4 py-4 gap-3">
      <div class="flex flex-column gap-3">
        <div class="text-gray-700 text-lg font-bold">Offline Mode Enabled</div>
        <div class="text-xs text-gray-500">
          <div>
            Offline mode is currently under development. Features are limited and being rolled out in an experimental
            basis.
          </div>
          <div>Please note that you may experience more bugs by toggling this feature.</div>
        </div>
      </div>
      <div>
        <PvToggleButton v-model="offlineEnabled" on-label="On" off-label="Off" class="p-2 rounded" />
      </div>
    </div>
    <div v-if="userData?.offlineEnabled" class="flex flex-column bg-gray-100 my-2 p-4 rounded gap-4">
      <div class="flex flex-wrap justify-content-between gap-3">
        <div class="flex flex-column gap-2">
          <div class="text-lg text-gray-700 font-bold">Offline Tasks</div>
          <div class="text-sm text-gray-500">
            Add tasks to this list to maintain access to them while you are offline.
          </div>
        </div>
        <div class="flex gap-1">
          <PvDropdown
            v-model="selectedOfflineTask"
            :options="formattedTasks"
            class="h-3rem"
            option-label="name"
            option-value="name"
            placeholder="Select a Task"
          />
          <PvButton
            class="m-0 bg-primary text-white border-none border-round h-3rem text-sm hover:bg-red-900"
            :disabled="!selectedOfflineTask"
            @click="addOfflineTask"
          >
            Add
          </PvButton>
        </div>
      </div>
      <div class="flex flex-column">
        <div
          v-if="selectedOfflineTasks.length === 0"
          class="px-2 py-4 rounded bg-gray-200 flex align-items-center justify-content-center text-gray-400"
        >
          No tasks added.
        </div>
        <div v-else class="flex flex-column gap-2">
          <div
            v-for="name in selectedOfflineTasks"
            :key="name"
            class="flex justify-content-end font-bold gap-2 p-3 bg-gray-200 rounded"
          >
            <PvTag> {{ name }}</PvTag>
            <div>
              <PvButton
                class="text-red-900 border-none bg-gray-100 rounded h-2rem text-sm hover:bg-red-900 hover:text-white"
                @click="() => removeOfflineTask(name)"
              >
                <i class="pi pi-trash"></i>
              </PvButton>
            </div>
          </div>
        </div>
      </div>
      <PvDivider />

      <div class="flex justify-content-between flex-wrap gap-3">
        <div class="flex flex-column gap-2">
          <div class="text-lg text-gray-700 font-bold">Offline Administrations</div>
          <div class="text-sm text-gray-500">
            Add administrations to this list to maintain access to them while you are offline.
          </div>
        </div>
        <div v-if="isLoadingAdministrations === true" class="flex text-gray-600 font-light uppercase font-xs">
          <i class="pi pi-spinner pi-spin"></i>
          <div class="text-xs">Loading Adminstrations</div>
        </div>
        <div v-else class="flex gap-1">
          <PvDropdown
            v-model="selectedOfflineAdministration"
            :options="administrations"
            option-label="name"
            class="h-3rem"
            option-value="name"
            placeholder="Select an Administration"
          />
          <PvButton
            class="m-0 bg-primary text-white border-none border-round h-3rem text-sm hover:bg-red-900"
            :disabled="!selectedOfflineAdministration"
            @click="addOfflineAdministration"
          >
            Add
          </PvButton>
        </div>
      </div>
      <div class="flex flex-column">
        <div
          v-if="selectedOfflineAdministrations.length === 0"
          class="px-2 py-4 rounded bg-gray-200 flex align-items-center justify-content-center text-gray-400"
        >
          No administrations added
        </div>
        <div v-else class="flex flex-column gap-2">
          <div
            v-for="name in selectedOfflineAdministrations"
            :key="name"
            class="flex justify-content-end font-bold gap-2 p-3 bg-gray-200 rounded"
          >
            <PvTag> {{ name }}</PvTag>
            <div>
              <PvButton
                class="text-red-900 bg-gray-100 rounded border-none h-2rem text-sm hover:bg-red-900 hover:text-white"
                @click="() => removeOfflineAdministration(name)"
              >
                <i class="pi pi-trash"></i>
              </PvButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="unsavedChanges === true">
      <PvAlert severity="warning" class="my-2">
        <div class="flex flex-column gap-2">
          <div class="text-lg font-bold">Unsaved Changes</div>
          <div class="text-sm">You have unsaved changes.</div>
        </div>
      </PvAlert>
    </div>
    <div class="flex align-items-center justify-content-center mt-2">
      <div v-if="isSubmitting" class="mr-2">
        <PvButton
          disabled
          class="m-0 bg-primary text-white border-none border-round h-2rem text-md hover:bg-red-900"
          @click="saveOfflineSettings"
        >
          <i v-if="isSubmitting" class="pi pi-spinner pi-spin mr-2" />
          Save Settings
        </PvButton>
      </div>
      <div v-else>
        <PvButton
          class="m-0 bg-primary text-white border-none border-round h-2rem text-md hover:bg-red-900"
          @click="saveOfflineSettings"
        >
          <i v-if="isSubmitting" class="pi pi-spinner pi-spin mr-2" />
          Save Settings
        </PvButton>
      </div>
    </div>
  </div>
  <PvConfirmDialog />
</template>
<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { orderByDefault } from '@/helpers/query/utils';
import { taskFetcher } from '@/helpers/query/tasks';
import { administrationPageFetcher } from '@/helpers/query/administrations';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid, administrationQueryKeyIndex, userClaimsQueryKeyIndex } = storeToRefs(authStore);
const queryClient = useQueryClient();

// +-------------------------+
// | Firekit Inititalization |
// +-------------------------+
const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

// Query Init

const orderBy = ref(orderByDefault);
const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);
const canQueryAdministrations = computed(() => {
  return initialized.value && !isLoadingClaims.value;
});
const exhaustiveAdminOrgs = computed(() => userClaims.value?.claims?.adminOrgs);

// +---------+
// | Queries |
// +---------+
const { data: tasks } = useQuery({
  queryKey: ['tasks'],
  // non-registered tasks, all data
  queryFn: () => taskFetcher(false, true),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', uid, userClaimsQueryKeyIndex],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: userData, isLoading: isLoadingUserData } = useQuery({
  queryKey: ['userData', uid],
  queryFn: () => fetchDocById('users', uid.value),
  keepPrevousData: true,
  enabled: initialized,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

const { isLoading: isLoadingAdministrations, data: administrations } = useQuery({
  queryKey: ['administrations', uid, orderBy, ref(0), ref(10000), isSuperAdmin, administrationQueryKeyIndex],
  queryFn: () => administrationPageFetcher(orderBy, ref(10000), ref(0), isSuperAdmin, adminOrgs, exhaustiveAdminOrgs),
  keepPreviousData: true,
  enabled: canQueryAdministrations,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const formattedTasks = computed(() => {
  if (!tasks.value) return [];
  return tasks.value.map((task) => {
    return {
      name: task.taskName ?? task.id,
      ...task,
    };
  });
});

const offlineEnabled = ref(userData?.offlineEnabled ?? false);
const selectedOfflineTasks = ref([]);
const selectedOfflineAdministrations = ref([]);
const selectedOfflineTask = ref('');
const selectedOfflineAdministration = ref('');
const isSubmitting = ref(false);

const updateRefsFromUserData = (newUserData) => {
  // Ensure newUserData and its properties are defined
  const offlineAdministrations = newUserData?.offlineAdministrations ?? [];
  const offlineTasks = newUserData?.offlineTasks ?? [];

  // Assign values to selectedOfflineAdministrations and selectedOfflineTasks
  selectedOfflineAdministrations.value = offlineAdministrations.length > 0 ? [...offlineAdministrations] : [];
  selectedOfflineTasks.value = offlineTasks.length > 0 ? [...offlineTasks] : [];
  offlineEnabled.value = newUserData?.offlineEnabled ?? false;
};

watch(userData, (newUserData) => {
  updateRefsFromUserData(newUserData);
});

const addOfflineAdministration = () => {
  if (selectedOfflineAdministrations.value.includes(selectedOfflineAdministration.value)) {
    toast.add({
      severity: 'info',
      summary: 'Task already added',
      detail: 'This task has already been added',
      life: 3000,
    });
    return;
  } else {
    selectedOfflineAdministrations.value.push(selectedOfflineAdministration.value);
    return;
  }
};

const addOfflineTask = () => {
  if (selectedOfflineTasks.value.includes(selectedOfflineTask.value)) {
    toast.add({
      severity: 'info',
      summary: 'Task already added',
      detail: 'This task has already been added',
      life: 3000,
    });
    return;
  } else {
    selectedOfflineTasks.value.push(selectedOfflineTask.value);
    return;
  }
};

const removeOfflineAdministration = (name) => {
  console.log('called offline administrations');
  selectedOfflineAdministrations.value = selectedOfflineAdministrations.value.filter((task) => task !== name);
};

const removeOfflineTask = (name) => {
  console.log('called delete offline on:', name);
  selectedOfflineTasks.value = selectedOfflineTasks.value.filter((task) => task !== name);
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
  updateRefsFromUserData(userData.value);
});

const saveOfflineSettings = async () => {
  isSubmitting.value = true;
  await roarfirekit.value
    .updateUserData(uid.value, {
      offlineEnabled: offlineEnabled.value,
      offlineTasks: selectedOfflineTasks.value,
      offlineAdministrations: selectedOfflineAdministrations.value,
    })
    .then(() => {
      isSubmitting.value = false;
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Your Info has been updated', life: 3000 });
    })
    .catch((error) => {
      console.error('Error updating user data', error);
      toast.add({
        severity: 'error',
        summary: 'Unexpected Error',
        detail: 'An unexpected error has occurred.',
        life: 3000,
      });
    });
  // invalidate tanstack queries

  await queryClient.invalidateQueries(['userData', uid]);
};
</script>
<style scoped>
.table-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
  background-color: var(--surface-b);
  border: solid 1px var(--surface-d);
  border-radius: var(--border-radius);
}
.linked-chip {
  background-color: var(--green-400);
  color: var(--green-800);
  border: solid 1px var(--green-800);
  width: 100%;
  height: 100%;
}
.unlinked-chip {
  background-color: var(--red-400);
  color: var(--red-800);
  border: solid 1px var(--red-800);
  width: 100%;
  height: 100%;
}
.chip-container {
  width: 108px;
  height: 24px;
  margin-top: auto;
  margin-bottom: auto;
}
</style>
