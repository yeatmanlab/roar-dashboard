<template>
  <form class="p-fluid flex flex-column row-gap-8" @submit.prevent="handleSubmit()">
    <fieldset>
      <legend class="sr-only">Task</legend>
      <Dropdown
        v-model="selectedTaskId"
        :data="formattedTasks"
        :loading-data="isLoadingTasks"
        label="Select an Existing Task"
        placeholder="Select a Task"
        label-key="name"
        value-key="id"
      />
    </fieldset>

    <template v-if="selectedTask">
      <fieldset class="flex flex-column row-gap-4">
        <legend class="sr-only">Task Details</legend>
        <TextInput id="taskSlug" :model-value="selectedTask.slug" label="Slug (immutable)" :disabled="true" />

        <TextInput
          id="taskName"
          v-model="v$.name.$model"
          label="Name"
          :is-invalid="v$.name.$invalid && v$.name.$dirty"
          :errors="v$.name.$errors"
          :required="true"
        />

        <TextInput
          id="taskNameSimple"
          v-model="v$.nameSimple.$model"
          label="Simple Name"
          :is-invalid="v$.nameSimple.$invalid && v$.nameSimple.$dirty"
          :errors="v$.nameSimple.$errors"
          :required="true"
        />

        <TextInput
          id="taskNameTechnical"
          v-model="v$.nameTechnical.$model"
          label="Technical Name"
          :is-invalid="v$.nameTechnical.$invalid && v$.nameTechnical.$dirty"
          :errors="v$.nameTechnical.$errors"
          :required="true"
        />

        <TextInput
          id="taskDescription"
          v-model="v$.description.$model"
          label="Description"
          :is-invalid="v$.description.$invalid && v$.description.$dirty"
          :errors="v$.description.$errors"
        />

        <TextInput
          id="taskImage"
          v-model="v$.image.$model"
          label="Cover Image URL"
          type="url"
          :is-invalid="v$.image.$invalid && v$.image.$dirty"
          :errors="v$.image.$errors"
        />

        <TextInput
          id="taskTutorialVideo"
          v-model="v$.tutorialVideo.$model"
          label="Tutorial Video URL"
          type="url"
          :is-invalid="v$.tutorialVideo.$invalid && v$.tutorialVideo.$dirty"
          :errors="v$.tutorialVideo.$errors"
        />
      </fieldset>

      <fieldset class="flex flex-column row-gap-2">
        <div>
          <legend class="text-lg font-medium mb-0">Task Configuration</legend>
          <p class="text-md text-gray-500 mt-2">Adjust the configuration for this task.</p>
        </div>

        <TaskParametersConfigurator v-model="taskConfigModel" edit-mode />
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
import { computed, reactive, ref, watch } from 'vue';
import { helpers, maxLength, required, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvToast from 'primevue/toast';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useUpdateTaskMutation from '@/composables/mutations/useUpdateTaskMutation';
import Dropdown from '@/components/Form/Dropdown';
import TextInput from '@/components/Form/TextInput';
import TaskParametersConfigurator from './TaskParametersConfigurator.vue';
import { convertParamArrayToObject } from '@/helpers/convertParamArrayToObject';
import { convertObjectToParamArray } from '@/helpers/convertObjectToParamArray';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { TASK_NAME_MAX_LENGTH, TASK_NAME_REGEX } from '@/constants/tasks';
import { usePermissions } from '@/composables/usePermissions';

const toast = useToast();
const { userCan, Permissions } = usePermissions();
const { mutate: updateTask } = useUpdateTaskMutation();

// The query is internally gated on the auth store's access token, so no
// firekit-style init guard is needed here.
const { isLoading: isLoadingTasks, data: tasks } = useTasksQuery();

// The selected task's id.
const selectedTaskId = ref('');

// The selected task object from the catalog.
const selectedTask = computed(() => {
  if (!selectedTaskId.value) return null;
  return (tasks.value ?? []).find((task) => task.id === selectedTaskId.value) ?? null;
});

// Tasks array formatted for the dropdown component.
const formattedTasks = computed(() => {
  if (!tasks.value) return [];
  return tasks.value.map((task) => {
    return {
      ...task,
      name: task.name ?? task.id,
    };
  });
});

// Editable form model, populated from the selected task. Nullable backend
// fields are represented as empty strings for the inputs and mapped back to
// null on submit when cleared.
const formModel = reactive({
  name: '',
  nameSimple: '',
  nameTechnical: '',
  description: '',
  image: '',
  tutorialVideo: '',
});

// Task configuration model, edited as rows of { name, value, type }. The array
// identity is stable (rows are spliced in/out) so template bindings stay reactive.
const taskConfigModel = reactive([]);

// Validation rules mirroring the contract's UpdateTaskRequestBodySchema.
const taskNameValidator = helpers.withMessage(
  'Must start with a letter and contain only letters, numbers, spaces, hyphens, and underscores',
  helpers.regex(TASK_NAME_REGEX),
);

const formRules = {
  name: { required, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: taskNameValidator },
  nameSimple: { required, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: taskNameValidator },
  nameTechnical: { required, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: taskNameValidator },
  description: { required: false },
  image: { required: false, url },
  tutorialVideo: { required: false, url },
};

const v$ = useVuelidate(formRules, formModel);

// Populate the form whenever a task is selected.
watch(selectedTask, (task) => {
  if (!task) return;

  Object.assign(formModel, {
    name: task.name ?? '',
    nameSimple: task.nameSimple ?? '',
    nameTechnical: task.nameTechnical ?? '',
    description: task.description ?? '',
    image: task.image ?? '',
    tutorialVideo: task.tutorialVideo ?? '',
  });

  const taskConfig = task.taskConfig && typeof task.taskConfig === 'object' ? task.taskConfig : {};
  taskConfigModel.splice(0, taskConfigModel.length, ...convertObjectToParamArray(taskConfig));
  v$.value.$reset();
});

/**
 * Reset the form to its initial state.
 *
 * @returns {void}
 */
function resetForm() {
  selectedTaskId.value = '';
  taskConfigModel.splice(0, taskConfigModel.length);
  v$.value.$reset();
}

/**
 * Build the diffed PATCH body from the form state.
 *
 * Only changed fields are included — the contract's strict update schema
 * rejects empty bodies and immutable fields, so no-op submissions are
 * short-circuited by the caller. Cleared nullable fields (description, image,
 * tutorialVideo) are sent as null to clear them on the backend.
 *
 * @param {Object} task – The original task object from the catalog.
 * @returns {Object} The PATCH body containing only changed fields.
 */
function buildDiffedBody(task) {
  const body = {};

  for (const field of ['name', 'nameSimple', 'nameTechnical']) {
    if (formModel[field] !== (task[field] ?? '')) {
      body[field] = formModel[field];
    }
  }

  for (const field of ['description', 'image', 'tutorialVideo']) {
    if (formModel[field] !== (task[field] ?? '')) {
      body[field] = formModel[field] === '' ? null : formModel[field];
    }
  }

  const editedTaskConfig = convertParamArrayToObject(taskConfigModel) ?? {};
  const originalTaskConfig = task.taskConfig && typeof task.taskConfig === 'object' ? task.taskConfig : {};
  if (JSON.stringify(editedTaskConfig) !== JSON.stringify(originalTaskConfig)) {
    body.taskConfig = editedTaskConfig;
  }

  return body;
}

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the diffed PATCH body and submitting it to the API via the
 * updateTask mutation. No-op submissions (nothing changed) are short-circuited with an informational toast since the
 * contract rejects empty PATCH bodies.
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

  const task = selectedTask.value;
  const body = buildDiffedBody(task);

  if (Object.keys(body).length === 0) {
    toast.add({
      severity: TOAST_SEVERITIES.INFO,
      summary: 'Nothing to update',
      detail: 'No fields were changed.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    return;
  }

  await updateTask(
    { taskId: task.id, body },
    {
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
    },
  );
};
</script>
