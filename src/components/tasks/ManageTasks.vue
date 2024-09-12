<template>
  <PvToast />
  <PvSelectButton
    v-model="viewModel"
    :options="Object.values(MODEL_VIEWS)"
    class="flex my-2 select-button p-2"
    @change="handleViewChange($event.value)"
  />
  <div v-show="viewModel === MODEL_VIEWS.CREATE_TASK">
    <div v-if="!created" class="card px-3">
      <h1 class="text-center font-bold">Create a New Task</h1>
      <!-- <p class="login-title" align="left">Register for ROAR</p> -->
      <form class="p-fluid" @submit.prevent="handleNewTaskSubmit(!v$.$invalid)">
        <!-- Task name -->
        <div class="flex flex-column row-gap-3">
          <section class="form-section">
            <div class="p-input-icon-right">
              <label for="taskName">
                <small class="text-gray-400 font-bold">Task Name </small>
                <span class="required">*</span></label
              >
              <PvInputText
                v-model="v$.taskName.$model"
                name="taskName"
                :class="{ 'p-invalid': v$.taskName.$invalid && submitted }"
                aria-describedby="activation-code-error"
              />
            </div>
            <span v-if="v$.taskName.$error && submitted">
              <span v-for="(error, index) of v$.taskName.$errors" :key="index">
                <small class="p-error">{{ error.$message }}</small>
              </span>
            </span>
            <small v-if="(v$.taskName.$invalid && submitted) || v$.taskName.$pending.$response" class="p-error">
              {{ v$.taskName.required.$message.replace('Value', 'Task Name') }}
            </small>
          </section>
          <!-- Task ID -->
          <section class="form-section">
            <div class="p-input-icon-right">
              <label for="taskId">
                <small class="text-gray-400 font-bold">Task ID </small>
                <span class="required">*</span></label
              >
              <PvInputText
                v-model="v$.taskId.$model"
                name="taskId"
                :class="{ 'p-invalid': v$.taskId.$invalid && submitted }"
                aria-describedby="activation-code-error"
              />
            </div>
            <span v-if="v$.taskId.$error && submitted">
              <span v-for="(error, index) of v$.taskId.$errors" :key="index">
                <small class="p-error">{{ error.$message }}</small>
              </span>
            </span>
            <small v-else-if="(v$.taskId.$invalid && submitted) || v$.taskId.$pending.$response" class="p-error">
              {{ v$.taskId.required.$message.replace('Value', 'Task ID') }}
            </small>
          </section>
          <!-- Cover Image -->
          <section class="form-section">
            <div>
              <label for="coverImage">
                <small class="text-gray-400 font-bold">Cover Image (URL)</small>
              </label>
              <PvInputText v-model="taskFields.coverImage" name="coverImage" />
            </div>
          </section>
          <!--Description-->
          <section class="form-section">
            <div class="p-input-icon-right">
              <label for="description">
                <small class="text-gray-400 font-bold">Description</small>
              </label>
              <PvInputText v-model="taskFields.description" name="description" />
            </div>
          </section>
          <!--Task URL-->
          <section class="form-section">
            <div v-if="isExternalTask">
              <label for="taskURL">
                <small class="text-gray-400 font-bold">Task URL </small>
                <span class="required">*</span></label
              >
              <PvInputText
                v-model="v$.taskURL.$model"
                name="taskURL"
                :class="{ 'p-invalid': v$.taskURL.$invalid && submitted }"
                aria-describedby="first-name-error"
              />
              <span v-if="v$.taskURL.$error && submitted">
                <span v-for="(error, index) of v$.taskURL.$errors" :key="index">
                  <small class="p-error">{{ error.$message }}</small>
                </span>
              </span>
              <small v-else-if="(v$.taskURL.$invalid && submitted) || v$.taskURL.$pending.$response" class="p-error">
                {{ v$.taskURL.required.$message.replace('Value', 'Task URL') }}
              </small>
            </div>
          </section>
        </div>

        <div v-if="!isExternalTask">
          <h3 class="text-center">
            <strong>Configure Game Parameters</strong>
          </h3>
          <h4 class="text-center">Create the configurable game parameters for variants of this task.</h4>
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
        </div>

        <div v-else>
          <h3 class="text-center">Configure URL Parameters</h3>
          <h4 class="text-center">
            These parameters will be appended to the task URL to generate the variant URL for this task.
          </h4>
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
        </div>

        <div class="w-full flex justify-content-center">
          <div v-if="!isExternalTask" class="w-2">
            <PvButton
              label="Add Field"
              text
              icon="pi pi-plus"
              class="my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
              @click="addField(gameConfig)"
            />
          </div>
          <div v-else class="w-2">
            <PvButton
              label="Add Field"
              text
              icon="pi pi-plus"
              class="my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
              @click="addField(taskParams)"
            />
          </div>
        </div>
        <div class="flex flex-row align-items-center justify-content-center gap-2 flex-order-0 my-3">
          <div class="flex flex-row align-items-center">
            <PvCheckbox v-model="taskCheckboxData" input-id="chbx-demoTask" value="isDemoTask" />
            <label class="ml-1 mr-3" for="chbx-demoTask">Mark as <b>Demo Task</b></label>
          </div>
          <div class="flex flex-row align-items-center">
            <PvCheckbox v-model="taskCheckboxData" input-id="chbx-testTask" value="isTestTask" />
            <label class="ml-1 mr-3" for="chbx-testTask">Mark as <b>Test Task</b></label>
          </div>
          <div class="flex flex-row align-items-center">
            <PvCheckbox v-model="taskCheckboxData" input-id="chbx-externalTask" value="isExternalTask" />
            <label class="ml-1 mr-3" for="chbx-externalTask">Mark as <b>External Task</b> </label>
          </div>
          <div class="flex flex-row align-items-center">
            <PvCheckbox v-model="taskCheckboxData" input-id="chbx-registeredTask" value="isRegisteredTask" />
            <label class="ml-1 mr-3" for="chbx-externalTask">Mark as <b>Registered Task</b> </label>
          </div>
        </div>
        <div class="form-submit">
          <PvButton
            type="submit"
            label="Submit"
            class="submit-button bg-primary text-white border-none border-round p-2 hover:bg-red-900"
            severity="primary"
          />
        </div>
      </form>
    </div>

    <div v-else>
      <h2>Your task has been created!</h2>
      <p>
        Redirect to this URL upon task completion. ParticipantId can be any string, completed should be set to true.
      </p>
      <p>roar.education/?participantId=[$PARTICIPANT_ID]&completed=[$BOOLEAN]</p>
      <PvButton
        label="Create Another Task"
        class="submit-button bg-primary text-white border-none border-round p-2 hover:bg-red-900"
        @click="created = false"
      />
    </div>
  </div>

  <div v-show="viewModel === MODEL_VIEWS.UPDATE_TASK">
    <h1 class="text-center font-bold">Update a Task</h1>
    <form @submit.prevent="handleUpdateTask()">
      <section class="flex flex-column gap-2 mb-4 p-4">
        <label for="variant-fields" class="my-2">
          <small class="text-gray-400 font-bold">Select an Existing Task </small>
          <span class="required">*</span></label
        >
        <PvDropdown
          v-model="selectedTask"
          :options="formattedTasks"
          option-label="name"
          option-value="id"
          placeholder="Select a Task"
        />
      </section>

      <section v-if="taskData" class="flex flex-column align-items-start mt-4 p-4">
        <div class="flex flex-column w-full">
          <label for="fieldsOutput">
            <strong>Fields</strong>
          </label>
          <div v-for="(value, key) in taskData" :key="key">
            <div v-if="!ignoreFields.includes(key)">
              <div
                v-if="updatedTaskData[key] !== undefined"
                class="flex align-items-center justify-content-between gap-2 mb-1"
              >
                <label :for="key" class="w-1">
                  <em>{{ key }}</em>
                </label>
                <PvInputText :placeholder="typeof value" class="w-2 text-center" disabled />

                <PvInputText
                  v-if="typeof value === 'string'"
                  v-model="updatedTaskData[key]"
                  :placeholder="value"
                  class="flex-grow-1"
                />
                <PvInputNumber
                  v-else-if="typeof value === 'number'"
                  v-model="updatedTaskData[key]"
                  class="flex-grow-1"
                />
                <PvDropdown
                  v-else-if="typeof value === 'boolean'"
                  v-model="updatedTaskData[key]"
                  :options="booleanDropDownOptions"
                  option-label="label"
                  option-value="value"
                  class="flex-grow-1"
                />
                <PvButton
                  type="button"
                  icon="pi pi-trash"
                  class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
                  text
                  @click="deleteParam(key)"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-if="newFields.length > 0" class="w-full">
          <div v-for="(field, index) in newFields" :key="index" class="flex align-items-center column-gap-2 mb-1">
            <PvInputText v-model="field.name" placeholder="Field Name" />
            <PvDropdown v-model="field.type" :options="['string', 'number', 'boolean']" placeholder="Field Type" />

            <PvInputText
              v-if="field.type === 'string'"
              v-model="field.value"
              placeholder="Field Value"
              class="flex-grow-1"
            />
            <PvInputNumber
              v-if="field.type === 'number'"
              v-model="field.value"
              placeholder="Field Value"
              class="flex-grow-1"
            />
            <PvDropdown
              v-if="field.type === 'boolean'"
              v-model="field.value"
              placeholder="Field Value"
              :options="booleanDropDownOptions"
              option-label="label"
              option-value="value"
              class="flex-grow-1"
            />
            <PvButton
              type="button"
              icon="pi pi-trash"
              class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
              text
              @click="removeNewField(field.name, newFields)"
            />
          </div>
        </div>
        <PvButton
          label="Add Field"
          text
          icon="pi pi-plus"
          class="my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
          @click="newField"
        />

        <div class="flex flex-column w-full">
          <label for="gameConfigOutput">
            <strong>Game Parameters</strong>
          </label>
          <div v-for="(param, paramName) in updatedTaskData.gameConfig" id="paramsOutput" :key="paramName" class="mb-1">
            <div
              v-if="updatedTaskData.gameConfig[paramName] !== undefined"
              class="flex align-items-center justify-content-end column-gap-2"
            >
              <label :for="paramName" class="w-2">
                <em>{{ paramName }} </em>
              </label>
              <PvInputText id="inputEditParamType" :placeholder="typeof param" class="w-2 text-center" disabled />
              <PvInputText
                v-if="typeof param === 'string'"
                v-model="updatedTaskData.gameConfig[paramName]"
                :placeholder="param"
                class="flex-grow-1"
              />
              <PvInputNumber
                v-else-if="typeof param === 'number'"
                v-model="updatedTaskData.gameConfig[paramName]"
                class="flex-grow-1"
              />
              <PvDropdown
                v-else-if="typeof param === 'boolean'"
                v-model="updatedTaskData.gameConfig[paramName]"
                :options="booleanDropDownOptions"
                option-label="label"
                option-value="value"
                class="flex-grow-1"
              />
              <PvButton
                type="button"
                icon="pi pi-trash"
                class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
                text
                @click="deleteParam(paramName)"
              />
            </div>
          </div>
          <div v-if="addedGameConfig.length > 0">
            <div
              v-for="(field, index) in addedGameConfig"
              :key="index"
              class="flex align-items-center column-gap-2 mb-1"
            >
              <PvInputText v-model="field.name" placeholder="Field Name" />
              <PvDropdown v-model="field.type" :options="['string', 'number', 'boolean']" placeholder="Field Type" />
              <PvInputText
                v-if="field.type === 'string'"
                v-model="field.value"
                placeholder="Field Value"
                class="flex-grow-1"
              />
              <PvInputNumber
                v-if="field.type === 'number'"
                v-model="field.value"
                placeholder="Field Value"
                class="flex-grow-1"
              />
              <PvDropdown
                v-if="field.type === 'boolean'"
                v-model="field.value"
                placeholder="Field Value"
                :options="booleanDropDownOptions"
                option-label="label"
                option-value="value"
                class="flex-grow-1"
              />
              <PvButton
                type="button"
                icon="pi pi-trash"
                class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
                text
                @click="removeNewField(field.name, addedGameConfig)"
              />
            </div>
          </div>
        </div>
        <PvButton
          label="Add Parameter"
          text
          icon="pi pi-plus"
          class="my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
          @click="addGameConfig"
        />
      </section>

      <PvButton type="submit" class="my-4 bg-primary text-white border-none border-round p-2 hover:bg-red-900"
        >Update Task</PvButton
      >
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { required, requiredIf, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { cloneDeep, camelCase } from 'lodash';
import { useAuthStore } from '@/store/auth';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useAddTaskMutation from '@/composables/mutations/useAddTaskMutation';
import useUpdateTaskMutation from '@/composables/mutations/useUpdateTaskMutation';

const toast = useToast();
const initialized = ref(false);
const registeredTasksOnly = ref(true);
const taskCheckboxData = ref();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const { mutate: addTask } = useAddTaskMutation();
const { mutate: updateTask } = useUpdateTaskMutation();

const isExternalTask = computed(() => !!taskCheckboxData.value?.find((item) => item === 'isExternalTask'));
const selectedTask = ref(null);

let taskData = computed(() => {
  if (!selectedTask.value) return null;
  return tasks.value.find((task) => task.id === selectedTask.value);
});

// Reactive clone for holding changes made to taskData without affecting the original taskData and avoiding reactivity issues
let updatedTaskData = reactive(cloneDeep(taskData.value));
// Array of objects which models the new fields for the task object being updated
// This array of objects is later converted back into an object and spread into the updatedTaskData object
let newFields = reactive([]);
// Array of objects which models the new fields for the gameConfig object being updated
// This array of objects is later converted back into an object and spread into the updatedTaskData object
let addedGameConfig = reactive([]);

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

watch(taskData, (newVal) => {
  updatedTaskData = reactive(cloneDeep(newVal));
});

// Ignore these fields when displaying the task data
const ignoreFields = ['id', 'lastUpdated', 'gameConfig', 'parentDoc'];

const typeOptions = ['string', 'number', 'boolean'];

const booleanDropDownOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
];

const submitted = ref(false);
const created = ref(false);

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

const { data: tasks } = useTasksQuery(registeredTasksOnly, null, {
  enabled: initialized,
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

// For modeling a task to submit to the DB
const taskFields = reactive({
  taskName: '',
  taskURL: '',
  taskId: '',
  coverImage: '',
  description: '',
  gameConfig: {},
  // Based on type of account?
  external: isExternalTask,
});

// Validation rules for task fields
const taskRules = {
  taskName: { required },
  taskURL: { required: requiredIf(isExternalTask.value), url },
  taskId: { required },
};

const v$ = useVuelidate(taskRules, taskFields);

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

// For adding a new field to the new task document
function addField(type) {
  type.push({
    name: '',
    value: '',
    type: 'String',
  });
}

// For removing a field from the task document
function removeField(type, index) {
  type.splice(index, 1);
}

// Adds a new object to the newFields array, which models a new field for the task object being updated
const newField = () => {
  newFields.push({ name: '', value: '', type: 'string' });
};

// Removes a field from the newFields or addedGameConfig array
const removeNewField = (field, array) => {
  const updatedFields = array.filter((item) => item.name !== field);
  array.splice(0, array.length, ...updatedFields);
};

// Deletes a parameter from the updatedTaskData object
const deleteParam = (param) => {
  if (updatedTaskData['gameConfig'][param] !== undefined) {
    delete updatedTaskData['gameConfig'][param];
  }
  delete updatedTaskData[param];
};

// Adds a new object to the addedGameConfig array, which models a new field for the gameConfig object being updated
const addGameConfig = () => {
  addedGameConfig.push({ name: '', value: '', type: 'string' });
};

// Takes the array of objects that will be added to the current data object in Firestore
// and checks if any of the new fields are duplicates of existing fields to prevent overwriting data
const checkForDuplicates = (newItemsArray, currentDataObject) => {
  if (currentDataObject === undefined) return { isDuplicate: false, duplicateField: '' };

  const keys = Object.keys(currentDataObject);
  for (const newItem of newItemsArray) {
    if (keys.includes(newItem.name)) {
      return { isDuplicate: true, duplicateField: newItem.name };
    }
  }
  return { isDuplicate: false, duplicateField: '' };
};

// Helper function to check for errors before updating a task
// Returns true if there are errors, false if there are none
const checkForErrors = () => {
  if (!selectedTask.value) {
    toast.add({ severity: 'error', summary: 'Oops!', detail: 'Please select a task to update.', life: 3000 });
    return true;
  }

  if (newFields.length > 0) {
    const { isDuplicate, duplicateField } = checkForDuplicates(newFields, updatedTaskData);
    if (isDuplicate) {
      toast.add({
        severity: 'error',
        summary: 'Oops!',
        detail: `Duplicate field name detected: ${duplicateField}.`,
        life: 3000,
      });
      return true;
    }
  }

  if (addedGameConfig.length > 0) {
    const { isDuplicate, duplicateField } = checkForDuplicates(addedGameConfig, updatedTaskData.gameConfig);
    if (isDuplicate) {
      toast.add({
        severity: 'error',
        summary: 'Oops!',
        detail: `Duplicate field name detected: ${duplicateField}.`,
        life: 3000,
      });
      return true;
    }
  }
  return false;
};

const handleUpdateTask = async () => {
  // Check for errors before updating the task; end function if errors are found
  if (checkForErrors()) return;

  const convertedFields = convertParamsToObj(newFields);
  const convertedGameConfig = convertParamsToObj(addedGameConfig);

  const taskData = {
    taskId: selectedTask.value,
    data: {
      ...updatedTaskData,
      ...convertedFields,
      gameConfig: {
        ...updatedTaskData.gameConfig,
        ...convertedGameConfig,
      },
    },
  };

  await updateTask(taskData, {
    onSuccess: () => {
      toast.add({ severity: 'success', summary: 'Hoorah!', detail: 'Task successfully updated.', life: 3000 });
      resetUpdateTaskForm();
    },
    onError: (error) => {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Unable to update task, please try again.',
        life: 3000,
      });
      console.error('Failed to update task.', error);
    },
  });
};

const handleNewTaskSubmit = async (isFormValid) => {
  submitted.value = true;
  const isDemoData = !!taskCheckboxData.value?.find((item) => item === 'isDemoTask');
  const isTestData = !!taskCheckboxData.value?.find((item) => item === 'isTestTask');
  const isExternalTask = !!taskCheckboxData.value?.find((item) => item === 'isExternalTask');
  const isRegisteredTask = !!taskCheckboxData.value?.find((item) => item === 'isRegisteredTask');

  if (!isFormValid) {
    return;
  }

  const convertedGameConfig = convertParamsToObj(gameConfig) ?? {};
  const convertedTaskParams = isExternalTask ? convertParamsToObj(taskParams) : null;

  let newTaskObject = reactive({
    taskId: taskFields.taskId,
    taskName: taskFields.taskName,
    taskDescription: taskFields.description,
    taskImage: taskFields.coverImage,
    gameConfig: convertedGameConfig,
    taskParams: convertedTaskParams,
    demoData: isDemoData,
    testData: isTestData,
    registered: isRegisteredTask,
  });

  if (isExternalTask.value) {
    newTaskObject.taskURL = buildTaskURL(taskFields.taskURL, taskParams);
  }

  await addTask(newTaskObject, {
    onSuccess: () => {
      created.value = true;
      // @TODO: Add form reset to ensure users see a clean form when clicking the "Create Another Task" button. This
      // will also prevent users from accidentally submitting the same task twice.
    },
    onError: (error) => {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Unable to create task, please try again.',
        life: 3000,
      });
      console.error('Failed to add task.', error);
    },
  });
};

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

const resetUpdateTaskForm = () => {
  selectedTask.value = null;
  updatedTaskData = reactive(cloneDeep(taskData.value));
  clearFieldConfigArrays();
};

const clearFieldConfigArrays = () => {
  newFields = reactive([]);
  addedGameConfig = reactive([]);
};
</script>

<style>
.submit-button {
  margin: auto;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  border: none;
  width: 11.75rem;
}

.submit-button:hover {
  background-color: #2b8ecb;
  color: black;
}

.delete-btn {
  padding: 0.8rem;
}

.select-button .p-button:last-of-type:not(:only-of-type) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 25rem;
  border-bottom-right-radius: 25rem;
}

.select-button .p-button:first-of-type:not(:only-of-type) {
  border-top-left-radius: 25rem;
  border-bottom-left-radius: 25rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
