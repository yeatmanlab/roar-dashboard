<template>
  <form class="p-fluid flex flex-column row-gap-8" @submit.prevent="handleSubmit()">
    <fieldset class="flex flex-column row-gap-4">
      <legend class="sr-only">Task Details</legend>
      <TextInput
        id="taskName"
        v-model="v$.taskName.$model"
        label="Task Name"
        :is-invalid="v$.taskName.$invalid && v$.taskName.$dirty"
        :errors="v$.taskName.$errors"
        :required="true"
      />

      <TextInput
        id="taskId"
        v-model="v$.taskId.$model"
        label="Task ID"
        :is-invalid="v$.taskId.$invalid && v$.taskId.$dirty"
        :errors="v$.taskId.$errors"
        :required="true"
      />

      <TextInput
        id="coverImage"
        v-model="v$.coverImage.$model"
        label="Cover Image URL"
        :is-invalid="v$.coverImage.$invalid && v$.coverImage.$dirty"
        :errors="v$.coverImage.$errors"
      />

      <TextInput
        id="taskDescription"
        v-model="v$.taskDescription.$model"
        label="Description"
        :is-invalid="v$.taskDescription.$invalid && v$.taskDescription.$dirty"
        :errors="v$.taskDescription.$errors"
      />

      <TextInput
        v-if="v$.external.$model"
        id="taskURL"
        v-model="v$.taskURL.$model"
        label="Task URL"
        type="url"
        :is-invalid="v$.taskURL.$invalid && v$.taskURL.$dirty"
        :errors="v$.taskURL.$errors"
        :required="true"
      />
    </fieldset>

    <fieldset v-if="!v$.external.$model">
      <div>
        <legend class="text-lg font-medium mb-0">Configure Game Parameters</legend>
        <p class="text-md text-gray-500 mt-2">Create the configurable game parameters for variants of this task.</p>
      </div>

      <TaskParametersConfigurator v-model="gameParamsModel" />
    </fieldset>

    <fieldset v-else>
      <div>
        <legend class="text-lg font-medium mb-0">Configure URL Parameters</legend>
        <p class="text-md text-gray-500 mt-2">
          These parameters will be appended to the task URL to generate the variant URL for this task.
        </p>
      </div>

      <TaskParametersConfigurator v-model="taskParamsModel" />
    </fieldset>

    <div class="flex flex-column gap-4 lg:align-items-center">
      <fieldset
        class="flex flex-column lg:flex-row lg:align-items-center lg:justify-content-center gap-1 lg:gap-4 flex-order-0 my-3"
      >
        <legend class="sr-only">Task Options</legend>
        <CheckboxInput id="demoTask" v-model="v$.demoData.$model">
          <span>Mark as <b>Demo Task</b></span>
        </CheckboxInput>

        <CheckboxInput id="testTask" v-model="v$.testData.$model">
          <span>Mark as <b>Test Task</b></span>
        </CheckboxInput>

        <CheckboxInput id="externalTask" v-model="v$.external.$model">
          <span>Mark as <b>External Task</b></span>
        </CheckboxInput>

        <CheckboxInput id="registeredTask" v-model="v$.registered.$model">
          <span>Mark as <b>Registered Task</b></span>
        </CheckboxInput>
      </fieldset>

      <PvButton
        :disabled="!userCan(Permissions.Tasks.MANAGE)"
        v-tooltip="
          userCan(Permissions.Tasks.MANAGE)
            ? false
            : 'You do not have permission to create tasks. If you feel this is a mistake, please contact your administrator.'
        "
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
import { required, requiredIf, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvToast from 'primevue/toast';
import useAddTaskMutation from '@/composables/mutations/useAddTaskMutation';
import TextInput from '@/components/Form/TextInput';
import CheckboxInput from '@/components/Form/CheckboxInput';
import TaskParametersConfigurator from './TaskParametersConfigurator.vue';
import { convertParamArrayToObject } from '@/helpers/convertParamArrayToObject';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { TASK_PARAMETER_DEFAULT_SHAPE } from '@/constants/tasks';
import { usePermissions } from '@/composables/usePermissions';

const toast = useToast();
const { mutate: addTask } = useAddTaskMutation();
const { userCan, Permissions } = usePermissions();

// Initial form state for the task form.
const initialFormState = {
  taskName: '',
  taskURL: '',
  taskId: '',
  coverImage: '',
  taskDescription: '',
  demoData: false,
  testData: false,
  registered: false,
  external: false,
};

// Form model for creating a new task document.
let taskModel = reactive({ ...initialFormState });

// Game parameters model for the task form.
const gameParamsModel = reactive([Object.assign({}, TASK_PARAMETER_DEFAULT_SHAPE)]);

// Task parameters model for the task form.
const taskParamsModel = reactive([Object.assign({}, TASK_PARAMETER_DEFAULT_SHAPE)]);

// Validation rules for the task form model.
const taskRules = {
  taskName: {
    required,
  },
  taskURL: {
    required: requiredIf(() => taskModel.external),
    url,
  },
  taskId: {
    required,
  },
  coverImage: {
    required: false,
    url,
  },
  taskDescription: {
    required: false,
  },
  demoData: {
    required: false,
  },
  testData: {
    required: false,
  },
  registered: {
    required: false,
  },
  external: {
    required: false,
  },
};

const v$ = useVuelidate(taskRules, taskModel);

/**
 * Reset the form to its initial state.
 *
 * @returns {void}
 */
function resetForm() {
  Object.assign(taskModel, initialFormState);
  v$.value.$reset();
}

/**
 * Build external Task URL
 *
 * @param {String} url – The base URL to which the task parameters will be appended.
 * @param {Array} paramsObject – The object of task parameters to be appended to the URL.
 */
function buildTaskURL(url, paramsObject) {
  const baseUrl = new URL(url);
  const searchParams = new URLSearchParams(paramsObject);
  baseUrl.search = searchParams.toString();
  return baseUrl.toString();
}

/**
 * Handle form submission
 *
 * Executes a final form validation before compiling the task object and submitting it to the API via the addTask
 * mutation. Once submitted, the form is reset to its initial state to allow for further task creation.
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

  let taskObject = {
    taskId: taskModel.taskId,
    taskName: taskModel.taskName,
    taskDescription: taskModel.description,
    taskImage: taskModel.coverImage,
    demoData: taskModel.demoData,
    testData: taskModel.testData,
    registered: taskModel.registered,
  };

  if (taskModel.external) {
    taskObject.taskParams = convertParamArrayToObject(taskParamsModel);
    taskObject.taskURL = buildTaskURL(taskModel.taskURL, taskObject.taskParams);
  } else {
    taskObject.gameParams = convertParamArrayToObject(gameParamsModel) ?? {};
  }

  await addTask(taskObject, {
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
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Error',
        detail: 'Failed to create task, please try again.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error('Failed to add task.', error);
    },
  });
};
</script>
