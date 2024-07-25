<template>
  <h2 class="font-bold">Offline Settings</h2>
  <div class="flex flex-row justify-content-between bg-gray-100 px-4 py-4">
    <div class="flex flex-column gap-2">
      <div class="text-gray-600 text-lg">Offline Mode Enabled</div>
      <div class="text-sm">
        Offline mode is currently under development. By enrolling, you may experience a heightened level of bugs or
        undefined behavior.
      </div>
    </div>
    <div>
      <PvToggleButton v-model="checked" onLabel="On" offLabel="Off" class="p-2 rounded" />
    </div>
  </div>
  <div v-if="checked" class="flex flex-column bg-gray-100 my-2 p-4 rounded gap-4">
    <div class="flex justify-content-between">
      <div class="flex flex-column gap-2">
        <div class="text-lg text-gray-600">Tasks available offline</div>
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
        <div class="text-lg text-gray-600">Administrations available offline</div>
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
  <PvConfirmDialog />
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

// +----------------+
// | Initialization |
// +----------------+
const checked = ref(false);
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
import { useQuery } from '@tanstack/vue-query';
import { taskFetcher } from '@/helpers/query/tasks';

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

const { data: tasks } = useQuery({
  queryKey: ['tasks'],
  // non-registered tasks, all data
  queryFn: () => taskFetcher(false, true),
  keepPreviousData: true,
  enabled: initialized,
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

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});
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
