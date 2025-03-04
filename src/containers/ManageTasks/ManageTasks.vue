<template>
  <div class="p-4 pt-0" data-testid="manage-tasks">
    <div class="flex justify-between">
      <h1 class="text-center font-bold">
        <template v-if="viewModel === MODEL_VIEWS.CREATE_TASK">Create a Task</template>
        <template v-if="viewModel === MODEL_VIEWS.UPDATE_TASK">Update a Task</template>
      </h1>

      <PvSelectButton
        v-model="viewModel"
        :options="Object.values(MODEL_VIEWS)"
        class="flex my-2 select-button p-2"
        :pt="{ root: { 'data-testid': 'manage-tasks__view-select' } }"
        @change="handleViewChange($event.value)"
      />
    </div>

    <div v-show="viewModel === MODEL_VIEWS.CREATE_TASK">
      <CreateTaskForm />
    </div>

    <div v-show="viewModel === MODEL_VIEWS.UPDATE_TASK">
      <UpdateTaskForm />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PvSelectButton from 'primevue/selectbutton';
import CreateTaskForm from './components/CreateTaskForm.vue';
import UpdateTaskForm from './components/UpdateTaskForm.vue';

const MODEL_VIEWS = Object.freeze({
  CREATE_TASK: 'Create Task',
  UPDATE_TASK: 'Update Task',
});

const viewModel = ref(MODEL_VIEWS.CREATE_TASK);

const handleViewChange = (value) => {
  const selectedView = Object.values(MODEL_VIEWS).find((view) => view === value);
  if (selectedView) {
    viewModel.value = selectedView;
  }
};
</script>
