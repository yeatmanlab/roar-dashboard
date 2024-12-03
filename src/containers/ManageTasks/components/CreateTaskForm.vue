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

      <div class="flex flex-column row-gap-4">
        <div v-for="(param, index) in gameConfig" :key="index">
          <div class="flex gap-2 align-content-start flex-grow-0 params-container">
            <PvInputText v-model="param.name" placeholder="Name" />

            <PvDropdown v-model="param.type" :options="typeOptions" />

            <PvInputText v-if="param.type === 'string'" v-model="param.value" placeholder="Value" />

            <PvDropdown v-else-if="param.type === 'boolean'" v-model="param.value" :options="[true, false]" />

            <PvInputNumber v-else-if="param.type === 'number'" v-model="param.value" />

            <PvButton
              icon="pi pi-trash"
              class="delete-btn my-1 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
              text
              @click="removeField(gameConfig, index)"
            />
          </div>
        </div>

        <PvButton
          text
          class="p-3 text-primary border-none border-round transition-colors bg-gray-100 hover:bg-red-900 hover:text-white"
          @click="addField(gameConfig)"
        >
          <div class="w-full flex justify-content-center gap-2 text-md">
            <i class="pi pi-plus" />
            <span>Add Parameter</span>
          </div>
        </PvButton>
      </div>
    </fieldset>

    <fieldset v-else>
      <div>
        <legend class="text-lg font-medium mb-0">Configure URL Parameters</legend>
        <p class="text-md text-gray-500 mt-2">
          These parameters will be appended to the task URL to generate the variant URL for this task.
        </p>
      </div>

      <div class="flex flex-column row-gap-4">
        <div v-for="(param, index) in taskParams" :key="index">
          <div class="flex gap-2 align-content-start flex-grow-0 params-container">
            <PvInputText v-model="param.name" placeholder="Name" />

            <PvDropdown v-model="param.type" :options="typeOptions" />

            <PvInputText v-if="param.type === 'string'" v-model="param.value" placeholder="Value" />

            <PvDropdown v-else-if="param.type === 'boolean'" v-model="param.value" :options="[true, false]" />

            <PvInputNumber v-else-if="param.type === 'number'" v-model="param.value" />

            <PvButton
              icon="pi pi-trash"
              text
              class="delete-btn bg-primary text-white border-none border-round p-2 hover:bg-red-900"
              @click="removeField(taskParams, index)"
            />
          </div>
        </div>

        <PvButton
          text
          class="p-3 text-primary border-none border-round transition-colors bg-gray-100 hover:bg-red-900 hover:text-white"
          @click="addField(taskParams)"
        >
          <div class="w-full flex justify-content-center gap-2 text-md">
            <i class="pi pi-plus" />
            <span>Add Parameter</span>
          </div>
        </PvButton>
      </div>
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
import { reactive, ref } from 'vue';
import { required, requiredIf, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvDropdown from 'primevue/dropdown';
import PvInputNumber from 'primevue/inputnumber';
import PvInputText from 'primevue/inputtext';
import PvToast from 'primevue/toast';
import { camelCase } from 'lodash';
import useAddTaskMutation from '@/composables/mutations/useAddTaskMutation';
import TextInput from '@/components/Form/TextInput';
import CheckboxInput from '@/components/Form/CheckboxInput';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';

const toast = useToast();

const { mutate: addTask } = useAddTaskMutation();

const typeOptions = ['string', 'number', 'boolean'];

const booleanDropDownOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
];

// Initial form state for the task form.
const initialFormState = {
  taskName: '',
  taskURL: '',
  taskId: '',
  coverImage: '',
  taskDescription: '',
  gameConfig: {},
  demoData: false,
  testData: false,
  registered: false,
  external: false,
};

// Form model for creating a new task document.
let taskModel = reactive({ ...initialFormState });

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

// Array of objects which models the game configuration fields
// This array of objects is later converted back into an object and spread into the task object
const gameConfig = ref([
  {
    name: '',
    value: '',
    type: 'String',
  },
]);

// Array of objects which models the task parameters and is used to build the task URL
const taskParams = ref([
  {
    name: '',
    value: '',
    type: 'String',
  },
]);

/**
 * Add a new field to the gameConfig or taskParams array.
 *
 * @param {Object} type – The array of objects to which the new field will be added (gameConfig or taskParams).
 * @returns {void}
 */
function addField(type) {
  type.push({
    name: '',
    value: '',
    type: 'String',
  });
}

/**
 * Remove a field from the gameConfig or taskParams array.
 *
 * @param {Object} type – The array of objects to which the new field will be added (gameConfig or taskParams).
 * @param {Int} index – The index of the field to be removed.
 * @returns {void}
 */
function removeField(type, index) {
  type.splice(index, 1);
}

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

  const convertedGameConfig = convertParamsToObj(gameConfig) ?? {};
  const convertedTaskParams = taskModel.external ? convertParamsToObj(taskParams) : null;

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
    taskObject.taskURL = buildTaskURL(taskModel.taskURL, taskParams);
    taskObject.taskParams = convertParamsToObj(taskParams);
  } else {
    taskObject.gameConfig = convertParamsToObj(gameConfig) ?? {};
  }

  await addTask(newTaskObject, {
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
