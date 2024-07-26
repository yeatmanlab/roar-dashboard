<template>
  <div class="flex flex-column mb-3 gap-2">
    <div class="font-bold text-2xl">ROAR Offline</div>
    <div class="text-sm font-light">ROAR Offline allows for offline administration of tasks.</div>
  </div>
  <div v-if="isLoadingUserData" class="flex flex-column align-items-center justify-content-center">
    <AppSpinner />
    <div>Loading User Data</div>
  </div>
  <div v-else>
    <div class="flex flex-row justify-content-between bg-gray-100 px-4 py-4">
      <div class="flex flex-column gap-2">
        <div class="text-gray-600 text-lg font-bold">Offline Mode Enabled</div>
        <div class="text-sm">
          Offline mode is currently under development. By enrolling, you may experience a heightened level of bugs or
          undefined behavior.
        </div>
      </div>
      <div>
        <PvToggleButton v-model="offlineEnabled" onLabel="On" offLabel="Off" class="p-2 rounded" />
      </div>
    </div>
    <div v-if="offlineEnabled" class="flex flex-column bg-gray-100 my-2 p-4 rounded gap-4">
      <div class="flex justify-content-between">
        <div class="flex flex-column gap-2">
          <div class="text-lg text-gray-600 font-bold">Tasks available offline</div>
          <div class="text-sm">
            Administrations added to this list have their corresponding data cached onto your device
          </div>
        </div>
        <div class="flex gap-1">
          <PvDropdown
            v-model="selectedTask"
            :options="formattedTasks"
            option-label="name"
            option-value="id"
            placeholder="Select a Task"
          />
          <PvButton class="m-0 bg-primary text-white border-none border-round h-3rem text-sm hover:bg-red-900">
            Add Task
          </PvButton>
        </div>
      </div>
      <div class="flex flex-column">
        <div v-if="selectedTasks.length === 0">
          <PvTag severity="info"> No tasks added </PvTag>
        </div>
        <div v-else>
          <!-- <PvDataTable :value="selectedTasks">
      </PvDataTable>  -->
        </div>
      </div>
      <PvDivider />

      <div class="flex justify-content-between">
        <div class="flex flex-column gap-2">
          <div class="text-lg text-gray-600 font-bold">Administrations available offline</div>
          <div class="text-sm">
            Administrations added to this list have their corresponding data cached onto your device
          </div>
        </div>
        <div class="flex gap-1">
          <PvDropdown
            v-model="selectedTask"
            :options="formattedTasks"
            option-label="name"
            option-value="id"
            placeholder="Select a Task"
          />
          <PvButton class="m-0 bg-primary text-white border-none border-round h-3rem text-sm hover:bg-red-900">
            Add Administration
          </PvButton>
        </div>
      </div>
      <div class="flex flex-column">
        <div v-if="selectedTasks.length === 0">
          <PvTag severity="info"> No administrations added </PvTag>
        </div>
        <div v-else>
          <!-- <PvDataTable :value="selectedTasks">
      </PvDataTable>  -->
        </div>
      </div>
    </div>
    <div class="flex align-items-center justify-content-center mt-2">
      <div v-if="isSubmitting" class="mr-2">
        <PvButton
          disabled
          class="m-0 bg-primary text-white border-none border-round h-2rem text-md hover:bg-red-900"
          :onClick="saveSettings"
        >
          <i v-if="isSubmitting" class="pi pi-spinner pi-spin mr-2" />
          Save Settings
        </PvButton>
      </div>
      <div v-else>
        <PvButton
          class="m-0 bg-primary text-white border-none border-round h-2rem text-md hover:bg-red-900"
          :onClick="saveSettings"
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
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import { taskFetcher } from '@/helpers/query/tasks';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid } = storeToRefs(authStore);

// +-------------------------+
// | Firekit Inititalization |
// +-------------------------+
const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const selectedTasks = ref([]);
const isSubmitting = ref(false);

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

const { data: userData, isLoading: isLoadingUserData } = useQuery({
  queryKey: ['userData', uid],
  queryFn: () => fetchDocById('users', uid.value),
  keepPrevousData: true,
  enabled: initialized,
  staleTime: 1000 * 60 * 5, // 5 minutes
  onSuccess: (data) => {
    offlineEnabled.value = data.offlineEnabled ?? false;
  },
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
unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

const saveSettings = async () => {
  isSubmitting.value = true;
  await roarfirekit.value
    .updateUserData(uid.value, { offlineEnabled: offlineEnabled.value })
    .then(() => {
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
    });
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
