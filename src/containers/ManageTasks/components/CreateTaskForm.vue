<template>
  <form class="p-fluid flex flex-column row-gap-8" @submit.prevent="handleSubmit()">
    <fieldset class="flex flex-column row-gap-4">
      <legend class="sr-only">Task Details</legend>
      <TextInput
        id="taskName"
        label="Task Name"
        v-model="v$.taskName.$model"
        :isInvalid="v$.taskName.$invalid && v$.taskName.$dirty"
        :errors="v$.taskName.$errors"
        :required="true"
        ariaDescribedBy="activation-code-error"
      />

      <TextInput
        id="taskId"
        label="Task ID"
        v-model="v$.taskId.$model"
        :isInvalid="v$.taskId.$invalid && v$.taskId.$dirty"
        :errors="v$.taskId.$errors"
        :required="true"
        ariaDescribedBy="activation-code-error"
      />

      <TextInput
        id="coverImage"
        label="Cover Image URL"
        v-model="v$.coverImage.$model"
        :isInvalid="v$.coverImage.$invalid && v$.coverImage.$dirty"
        :errors="v$.coverImage.$errors"
        ariaDescribedBy="activation-code-error"
      />

      <TextInput
        id="taskDescription"
        label="Description"
        v-model="v$.taskDescription.$model"
        :isInvalid="v$.taskDescription.$invalid && v$.taskDescription.$dirty"
        :errors="v$.taskDescription.$errors"
        ariaDescribedBy="activation-code-error"
      />

      <TextInput
        v-if="v$.external.$model"
        id="taskURL"
        label="Task URL"
        type="url"
        v-model="v$.taskURL.$model"
        :isInvalid="v$.taskURL.$invalid && v$.taskURL.$dirty"
        :errors="v$.taskURL.$errors"
        :required="true"
        ariaDescribedBy="activation-code-error"
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
        <CheckboxInput v-model="v$.demoData.$model" id="demoTask">
          <span>Mark as <b>Demo Task</b></span>
        </CheckboxInput>

        <CheckboxInput v-model="v$.testData.$model" id="testTask">
          <span>Mark as <b>Test Task</b></span>
        </CheckboxInput>

        <CheckboxInput v-model="v$.external.$model" id="externalTask">
          <span>Mark as <b>External Task</b></span>
        </CheckboxInput>

        <CheckboxInput v-model="v$.registered.$model" id="registeredTask">
          <span>Mark as <b>Registered Task</b></span>
        </CheckboxInput>
      </fieldset>

      <PvButton
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
import { reactive, ref, watch } from 'vue';
import { required, requiredIf, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvToast from 'primevue/toast';
import { camelCase } from 'lodash';
import useAddTaskMutation from '@/composables/mutations/useAddTaskMutation';
import TextInput from '@/components/Form/TextInput';
import CheckboxInput from '@/components/Form/CheckboxInput';
import TaskParametersConfigurator from './TaskParametersConfigurator.vue';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { TASK_PARAMETER_DEFAULT_SHAPE } from '@/constants/tasks';

const toast = useToast();
const { mutate: addTask } = useAddTaskMutation();

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
const gameParamsModel = reactive([TASK_PARAMETER_DEFAULT_SHAPE]);

// Task parameters model for the task form.
const taskParamsModel = reactive([TASK_PARAMETER_DEFAULT_SHAPE]);

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

function convertParamsToObj(paramType) {
  // If the paramType is an array of objects with a key called "value", convert it to an object
  // Otherwise, just use the paramType object
  const target = paramType.value !== undefined ? paramType.value : paramType;

  return target.reduce((acc, item) => {
    if (item.name) {
      acc[camelCase(item.name)] = item.value;
    }
    return acc;
  }, {});
}

function buildTaskURL(url, params) {
  const baseURL = url;

  let queryParams = url.includes('/?') ? '' : '/?';

  params.value.forEach((param, i) => {
    if (param.name) {
      if (i === 0) {
        queryParams += `${param.name}=${param.value}`;
      } else {
        queryParams += `&${param.name}=${param.value}`;
      }
    }
  });

  const completeURL = baseURL + queryParams;

  return completeURL;
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
  if (!isFormValid) return;

  let taskObject = reactive({
    taskId: taskModel.taskId,
    taskName: taskModel.taskName,
    taskDescription: taskModel.description,
    taskImage: taskModel.coverImage,
    demoData: taskModel.demoData,
    testData: taskModel.testData,
    registered: taskModel.registered,
  });

  if (taskModel.external) {
    taskObject.taskURL = buildTaskURL(taskModel.taskURL, taskParamsModel);
    taskObject.taskParams = convertParamsToObj(taskParamsModel);
  } else {
    taskObject.gameParams = convertParamsToObj(gameParamsModel) ?? {};
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
        detail: 'Unable to create task, please try again.',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error('Failed to add task.', error);
    },
  });
};
</script>
