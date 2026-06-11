<template>
  <form class="p-fluid flex flex-column row-gap-8" @submit.prevent="handleSubmit()">
    <fieldset class="flex flex-column row-gap-4">
      <legend class="sr-only">Task Details</legend>
      <TextInput
        id="taskSlug"
        v-model="v$.slug.$model"
        label="Slug"
        :is-invalid="v$.slug.$invalid && v$.slug.$dirty"
        :errors="v$.slug.$errors"
        :required="true"
      />

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

    <!-- TODO(external-tasks): The legacy external-task flow (off-platform `taskURL` + URL parameters) is not
         represented on the new contract. If external tasks return, decide whether they're encoded inside
         `taskConfig` or get first-class contract fields. -->
    <fieldset>
      <div>
        <legend class="text-lg font-medium mb-0">Task Configuration</legend>
        <p class="text-md text-gray-500 mt-2">
          Create the task's configuration. These values seed the configurable parameters for variants of this task.
        </p>
      </div>

      <TaskParametersConfigurator v-model="taskConfigModel" />
    </fieldset>

    <div class="flex flex-column gap-4 lg:align-items-center">
      <PvButton
        v-tooltip="
          userCan(Permissions.Tasks.CREATE)
            ? false
            : 'You do not have permission to create tasks. If you feel this is a mistake, please contact your administrator.'
        "
        :disabled="!userCan(Permissions.Tasks.CREATE)"
        type="submit"
        label="Submit"
        class="self-center w-full lg:w-4 bg-primary align-right text-white border-none border-round p-3 hover:bg-red-900"
        severity="primary"
      />
    </div>
  </form>

  <PvToast />
</template>

<script setup>
import { reactive } from 'vue';
import { helpers, maxLength, required, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvToast from 'primevue/toast';
import useAddTaskMutation from '@/composables/mutations/useAddTaskMutation';
import TextInput from '@/components/Form/TextInput';
import TaskParametersConfigurator from '@/components/TaskParametersConfigurator/TaskParametersConfigurator.vue';
import { buildTaskConfigFromRows } from '@/helpers/taskConfig';
import { StatusCodes } from 'http-status-codes';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_NAME_MAX_LENGTH,
  TASK_NAME_REGEX,
  TASK_SLUG_MAX_LENGTH,
  TASK_SLUG_REGEX,
} from '@/constants/tasks';
import { usePermissions } from '@/composables/usePermissions';

const toast = useToast();
const { mutate: addTask } = useAddTaskMutation();
const { userCan, Permissions } = usePermissions();

// Initial form state for the task form, mirroring CreateTaskRequestBodySchema.
const initialFormState = {
  slug: '',
  name: '',
  nameSimple: '',
  nameTechnical: '',
  description: '',
  image: '',
  tutorialVideo: '',
};

// Form model for creating a new task.
const taskModel = reactive({ ...initialFormState });

// Task configuration model, edited as rows of { name, value, type }. Starts
// empty so tasks with an intentionally empty taskConfig submit without having
// to discover that a blank seed row must be deleted first.
const taskConfigModel = reactive([]);

// Validation rules mirroring the contract's CreateTaskRequestBodySchema so
// admins get inline feedback instead of a backend 400.
const taskNameValidator = helpers.withMessage(
  'Must start with a letter and contain only letters, numbers, spaces, hyphens, and underscores',
  helpers.regex(TASK_NAME_REGEX),
);

const taskRules = {
  slug: {
    required,
    maxLength: maxLength(TASK_SLUG_MAX_LENGTH),
    slugFormat: helpers.withMessage(
      'Must be lowercase alphanumeric with hyphens between segments (e.g., "my-task")',
      helpers.regex(TASK_SLUG_REGEX),
    ),
  },
  name: { required, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: taskNameValidator },
  nameSimple: { required, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: taskNameValidator },
  nameTechnical: { required, maxLength: maxLength(TASK_NAME_MAX_LENGTH), nameFormat: taskNameValidator },
  // Optional fields simply omit `required` — vuelidate treats every key as a validator function.
  description: { maxLength: maxLength(TASK_DESCRIPTION_MAX_LENGTH) },
  image: { url },
  tutorialVideo: { url },
};

const v$ = useVuelidate(taskRules, taskModel);

/**
 * Reset the form to its initial state.
 *
 * @returns {void}
 */
function resetForm() {
  Object.assign(taskModel, initialFormState);
  taskConfigModel.splice(0, taskConfigModel.length);
  v$.value.$reset();
}

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the request body and submitting it to the API via the addTask
 * mutation. Optional fields are omitted when empty — the contract's strict schema rejects empty strings. Once
 * submitted, the form is reset to its initial state to allow for further task creation.
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

  // Optional fields are omitted when blank — the contract's strict schema
  // rejects empty strings. Values are trimmed so whitespace-only input is
  // treated as blank rather than bouncing off the backend's trim().min(1).
  const description = taskModel.description.trim();
  const image = taskModel.image.trim();
  const tutorialVideo = taskModel.tutorialVideo.trim();

  const body = {
    slug: taskModel.slug,
    name: taskModel.name,
    nameSimple: taskModel.nameSimple,
    nameTechnical: taskModel.nameTechnical,
    taskConfig: buildTaskConfigFromRows(taskConfigModel),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(tutorialVideo ? { tutorialVideo } : {}),
  };

  addTask(body, {
    onSuccess: () => {
      toast.add({
        severity: TOAST_SEVERITIES.SUCCESS,
        summary: 'Success',
        detail: 'The task has been successfully created.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      resetForm();
    },
    onError: (error) => {
      // 409 means the slug is already taken — the one failure mode admins can fix themselves.
      const isConflict = error?.status === StatusCodes.CONFLICT;
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Error',
        detail: isConflict
          ? `A task with the slug "${taskModel.slug}" already exists. Please choose a different slug.`
          : 'Failed to create task, please try again.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error('Failed to add task.', error);
    },
  });
};
</script>
