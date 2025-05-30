<template>
  <form class="p-fluid flex flex-column row-gap-8" @submit.prevent="handleSubmit()">
    <fieldset>
      <legend class="sr-only">Task</legend>
      <Dropdown
        v-model="selectedTask"
        :data="formattedTasks"
        :loading-data="isLoadingTasks"
        label="Select an Existing Task"
        placeholder="Select a Task"
        label-key="name"
        value-key="id"
      />
    </fieldset>

    <template v-if="taskData">
      <fieldset class="flex flex-column row-gap-2">
        <div>
          <legend class="text-lg font-medium mb-0">Task Configuration</legend>
          <p class="text-md text-gray-500 mt-2">Adjust the core configuration for this task.</p>
        </div>

        <TaskParametersConfigurator
          v-model="taskCoreConfig"
          edit-mode
          disable-deleting-existing-rows
          :validation-key-blacklist="ignoreFields"
        />
      </fieldset>

      <fieldset class="flex flex-column row-gap-2">
        <div>
          <legend class="text-lg font-medium mb-0">Game Parameters</legend>
          <p class="text-md text-gray-500 mt-2">Create the game parameters for variants of this task.</p>
        </div>

        <TaskParametersConfigurator v-model="taskGameParameters" edit-mode :validation-key-blacklist="ignoreFields" />
      </fieldset>

      <div class="flex flex-column gap-4 lg:align-items-center">
        <PvButton
          v-tooltip="
            userCan(Permissions.Tasks.UPDATE)
              ? false
              : 'You do not have permission to update tasks. If you feel this is a mistake, please contact your administrator.'
          "
          :disabled="!userCan(Permissions.Tasks.UPDATE)"
          type="submit"
          label="Update Task"
          class="self-center w-full lg:w-4 bg-primary align-right text-white border-none border-round p-3 hover:bg-red-900"
          severity="primary"
        />
      </div>
    </template>
  </form>

  <PvToast />
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRefs, watch } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvToast from 'primevue/toast';
import { useAuthStore } from '@/store/auth';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useUpdateTaskMutation from '@/composables/mutations/useUpdateTaskMutation';
import Dropdown from '@/components/Form/Dropdown';
import TaskParametersConfigurator from './TaskParametersConfigurator.vue';
import { convertParamArrayToObject } from '@/helpers/convertParamArrayToObject';
import { convertObjectToParamArray } from '@/helpers/convertObjectToParamArray';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { usePermissions } from '@/composables/usePermissions';

const props = defineProps({
  registeredTasksOnly: {
    type: Boolean,
    default: true,
  },
});

const { registeredTasksOnly } = toRefs(props);

const toast = useToast();
const initialized = ref(false);
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const { userCan, Permissions } = usePermissions();

const { mutate: updateTask } = useUpdateTaskMutation();
const { refetch: toggleRegisteredTasks } = useTasksQuery(registeredTasksOnly.value);

// The selected task to be updated.
const selectedTask = ref('');

// Validation rules for the task form model.
// @NOTE: vuelidate is initialised without any rules or model as this component relies on nested form models. The nested
// task parameters configurator components handle their own validation rules.
const v$ = useVuelidate();

// Ignore these fields when displaying the task data
const ignoreFields = ['id', 'lastUpdated', 'gameConfig', 'parentDoc'];

let taskData = computed(() => {
  if (!selectedTask.value) return null;
  return tasks.value.find((task) => task.id === selectedTask.value);
});

let taskCoreConfig = reactive([]);
let taskGameParameters = reactive([]);

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

const { isLoading: isLoadingTasks, data: tasks } = useTasksQuery(registeredTasksOnly, null, {
  enabled: initialized,
});

// Tasks array formatted for the dropdown component
// @TODO: Verify if this can be removed in favour of simply using the tasks array on the dropdown component and
// specifying the appropriate label and value keys. This is only possible if all tasks have a name property.
const formattedTasks = computed(() => {
  if (!tasks.value) return [];
  return tasks.value.map((task) => {
    return {
      name: task.taskName ?? task.id,
      ...task,
    };
  });
});

watch(
  taskData,
  (newVal) => {
    if (!newVal) return;

    // When tasks are created, params are stored as an key-value object. To edit tasks, revert to an array of objects
    // compatible with the TaskParametersConfigurator component, requiring a name, value, and type property.
    let taskParams = convertObjectToParamArray(newVal);
    let taskGameConfigParams = newVal.gameConfig ? convertObjectToParamArray(newVal.gameConfig) : [];

    // Remove ignore fields from the task data
    taskParams = taskParams.filter((item) => !ignoreFields.includes(item.name));

    // Update the form models
    taskCoreConfig = reactive(taskParams);
    taskGameParameters = reactive(taskGameConfigParams);
  },
  { immediate: true },
);
watch(
  registeredTasksOnly,
  () => {
    toggleRegisteredTasks(registeredTasksOnly, null);
  },
  { immediate: true },
);
/**
 * Reset the form to its initial state.
 *
 * @returns {void}
 */
function resetForm() {
  selectedTask.value = '';
  v$.value.$reset();
}

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the task object and submitting it to the API via the updateTask
 * mutation. Once submitted, the form is reset to its initial state to allow for further task updates.
 *
 * @returns {void}
 */
const handleSubmit = async () => {
  const isFormValid = await v$.value.$validate();

  if (!isFormValid) {
    toast.add({
      severity: TOAST_SEVERITIES.WARNING,
      summary: 'Not so fast!',
      detail: 'Invalid input, please check errors.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return;
  }

  const taskCoreConfigObject = convertParamArrayToObject(taskCoreConfig);
  const taskGameParametersObject = convertParamArrayToObject(taskGameParameters);

  // Construct the task object to be submitted.
  let taskObject = {
    taskId: selectedTask.value,
    data: {
      // Add the updated task core config data.
      ...taskCoreConfigObject,

      // Add the original task data that was not allowed to be edited.
      // @NOTE: This is necessary as even though we don't display these fields and apply validation rules to prevent
      // these fields from being added manually, this is an additional layer to ensure data integrity.
      ...Object.fromEntries(Object.entries(taskData.value).filter(([key]) => ignoreFields.includes(key))),

      // Add the game config data.
      gameConfig: {
        ...taskGameParametersObject,
      },
    },
  };

  await updateTask(taskObject, {
    onSuccess: () => {
      toast.add({
        severity: TOAST_SEVERITIES.SUCCESS,
        summary: 'Hoorah!',
        detail: 'Task successfully updated.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
      resetForm();
    },
    onError: (error) => {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Error',
        detail: 'Failed to update task, please try again.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error('Failed to update task.', error);
    },
  });
};
</script>
