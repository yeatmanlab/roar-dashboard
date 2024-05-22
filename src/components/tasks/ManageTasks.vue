<template>
  <PvToast />
  <PvTabView>
    <PvTabPanel header="Create Task">
      <div v-if="!created" class="card px-3">
        <h1 class="text-center font-bold">Create a New Task</h1>
        <!-- <p class="login-title" align="left">Register for ROAR</p> -->
        <form class="p-fluid" @submit.prevent="handleNewTaskSubmit(!t$.$invalid)">
          <!-- Task name -->
          <div class="flex flex-column row-gap-3">
            <section class="form-section">
              <div class="p-input-icon-right">
                <label for="taskName">Task Name <span class="required">*</span></label>
                <PvInputText
                  v-model="t$.taskName.$model"
                  name="taskName"
                  :class="{ 'p-invalid': t$.taskName.$invalid && submitted }"
                  aria-describedby="activation-code-error"
                />
              </div>
              <span v-if="t$.taskName.$error && submitted">
                <span v-for="(error, index) of t$.taskName.$errors" :key="index">
                  <small class="p-error">{{ error.$message }}</small>
                </span>
              </span>
              <small v-if="(t$.taskName.$invalid && submitted) || t$.taskName.$pending.$response" class="p-error">
                {{ t$.taskName.required.$message.replace('Value', 'Task Name') }}
              </small>
            </section>
            <!-- Task ID -->
            <section class="form-section">
              <div class="p-input-icon-right">
                <label for="taskId">Task ID <span class="required">*</span></label>
                <PvInputText
                  v-model="t$.taskId.$model"
                  name="taskId"
                  :class="{ 'p-invalid': t$.taskId.$invalid && submitted }"
                  aria-describedby="activation-code-error"
                />
              </div>
              <span v-if="t$.taskId.$error && submitted">
                <span v-for="(error, index) of t$.taskId.$errors" :key="index">
                  <small class="p-error">{{ error.$message }}</small>
                </span>
              </span>
              <small v-else-if="(t$.taskId.$invalid && submitted) || t$.taskId.$pending.$response" class="p-error">
                {{ t$.taskId.required.$message.replace('Value', 'Task ID') }}
              </small>
            </section>
            <!-- Cover Image -->
            <section class="form-section">
              <div>
                <label for="coverImage">Cover Image (URL)</label>
                <PvInputText v-model="taskFields.coverImage" name="coverImage" />
              </div>
            </section>
            <!--Description-->
            <section class="form-section">
              <div class="p-input-icon-right">
                <label for="description">Description </label>
                <PvInputText v-model="taskFields.description" name="description" />
              </div>
            </section>
            <!--Task URL-->
            <section class="form-section">
              <div v-if="isExternalTask">
                <label for="taskURL">Task URL <span class="required">*</span></label>
                <PvInputText
                  v-model="t$.taskURL.$model"
                  name="taskURL"
                  :class="{ 'p-invalid': t$.taskURL.$invalid && submitted }"
                  aria-describedby="first-name-error"
                />
                <span v-if="t$.taskURL.$error && submitted">
                  <span v-for="(error, index) of t$.taskURL.$errors" :key="index">
                    <small class="p-error">{{ error.$message }}</small>
                  </span>
                </span>
                <small v-else-if="(t$.taskURL.$invalid && submitted) || t$.taskURL.$pending.$response" class="p-error">
                  {{ t$.taskURL.required.$message.replace('Value', 'Task URL') }}
                </small>
              </div>
            </section>
          </div>

          <div v-if="!isExternalTask">
            <h3 class="text-center">Configure Game Parameters</h3>
            <h4 class="text-center">Create the configurable game parameters for variants of this task.</h4>
            <div v-for="(param, index) in gameConfig" :key="index">
              <div class="flex gap-2 align-content-start flex-grow-0 params-container">
                <PvInputText v-model="param.name" placeholder="Name" />

                <PvDropdown v-model="param.type" :options="typeOptions" />

                <PvInputText v-if="param.type === 'string'" v-model="param.value" placeholder="Value" />

                <PvDropdown v-else-if="param.type === 'boolean'" v-model="param.value" :options="[true, false]" />

                <PvInputNumber v-else-if="param.type === 'number'" v-model="param.value" show-buttons />

                <PvButton icon="pi pi-trash" class="delete-btn" text @click="removeField(gameConfig, index)" />
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

                <PvInputNumber v-else-if="param.type === 'number'" v-model="param.value" show-buttons />

                <PvButton icon="pi pi-trash" text class="delete-btn" @click="removeField(taskParams, index)" />
              </div>
            </div>
          </div>

          <div class="w-full flex justify-content-end">
            <div v-if="!isExternalTask" class="w-2">
              <PvButton label="Add Field" text icon="pi pi-plus" @click="addField(gameConfig)" />
            </div>
            <div v-else class="w-2">
              <PvButton label="Add Field" text icon="pi pi-plus" @click="addField(taskParams)" />
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
            <PvButton type="submit" label="Submit" class="submit-button" severity="primary" />
          </div>
        </form>
      </div>

      <div v-else>
        <h2>Your task has been created!</h2>
        <p>
          Redirect to this URL upon task completion. ParticipantId can be any string, completed should be set to true.
        </p>
        <p>roar.education/?participantId=[$PARTICIPANT_ID]&completed=[$BOOLEAN]</p>
      </div>
    </PvTabPanel>

    <PvTabPanel header="Edit Task"> Coming soon </PvTabPanel>
  </PvTabView>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { required, requiredIf, url } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { taskFetcher } from '@/helpers/query/tasks';

const toast = useToast();
const initialized = ref(false);
const registeredTasksOnly = ref(true);
const taskCheckboxData = ref();
const variantCheckboxData = ref();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const isExternalTask = computed(() => !!taskCheckboxData.value?.find((item) => item === 'isExternalTask'));

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

const { isFetching: isFetchingTasks, data: tasks } = useQuery({
  queryKey: ['tasks', registeredTasksOnly],
  queryFn: () => taskFetcher(registeredTasksOnly.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

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

const taskRules = {
  taskName: { required },
  taskURL: { required: requiredIf(isExternalTask.value), url },
  taskId: { required },
};

const gameConfig = ref([
  {
    name: '',
    value: '',
    type: 'String',
  },
]);

const taskParams = ref([
  {
    name: '',
    value: '',
    type: 'String',
  },
]);

const variantFields = reactive({
  variantName: '',
  selectedGame: {},
  // Based on type of account?
  external: true,
});

const variantRules = {
  variantName: { required },
  selectedGame: {
    id: { required },
  },
};

// Turn mappedGameConfig into an object {key: value, key: value...} which models gameConfig, filtered for deleted params
// This builds the object of parameters that will be sent to the DB
const variantParams = computed(() => {
  const params = reactive({});

  if (!mappedGameConfig.value) {
    return params;
  }

  filteredMappedGameConfig.value.forEach((param) => {
    params[param.name] = param.value;
  });

  return params;
});

// Turn the gameConfig object into an array of key/value pairs [{name: 'key', value: 'value', type: 'type'}...]
// This allows simplified editing of the gameConfig object
const mappedGameConfig = computed(() => {
  // Prevent any errors if selectedGame is not set
  if (!variantFields.selectedGame?.gameConfig) {
    return [];
  }

  return Object.entries(variantFields.selectedGame.gameConfig).map(([key, value]) => ({
    name: key,
    type: typeof value,
    value: value,
  }));
});

// Filter out any deleted params
const filteredMappedGameConfig = computed(() => {
  if (!mappedGameConfig.value) {
    return [];
  }

  return mappedGameConfig.value.filter((param) => !deletedParams.value.includes(param.name));
});

// Keep track of params that are not needed for the particular variant
const deletedParams = ref([]);

// Push the name of the param to the deletedParams array,
// Triggering a computation of the filteredMappedGameConfig and variantParams
const deleteParam = (param) => {
  deletedParams.value.push(param);
};

function addField(type) {
  type.push({
    name: '',
    value: '',
    type: 'String',
  });
}

function removeField(type, index) {
  type.splice(index, 1);
}

const typeOptions = ['string', 'number', 'boolean'];

const booleanDropDownOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
];

const t$ = useVuelidate(taskRules, taskFields);
const v$ = useVuelidate(variantRules, variantFields);
const submitted = ref(false);
const created = ref(false);

const handleNewTaskSubmit = async (isFormValid) => {
  submitted.value = true;
  const isDemoData = !!taskCheckboxData.value?.find((item) => item === 'isDemoTask');
  const isTestData = !!taskCheckboxData.value?.find((item) => item === 'isTestTask');
  const isExternalTask = !!taskCheckboxData.value?.find((item) => item === 'isExternalTask');
  const isRegisteredTask = !!taskCheckboxData.value?.find((item) => item === 'isRegisteredTask');

  if (!isFormValid) {
    return;
  }

  const convertedGameConfig = convertParamsToObj(gameConfig);
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

  // Write task variant to DB
  try {
    await authStore.roarfirekit.registerTaskVariant({ ...newTaskObject });
    created.value = true;
  } catch (error) {
    console.error(error);
  }
};

const handleVariantSubmit = async (isFormValid) => {
  submitted.value = true;
  const isDemoData = !!variantCheckboxData.value?.find((item) => item === 'isDemoVariant');
  const isTestData = !!variantCheckboxData.value?.find((item) => item === 'isTestVariant');
  // const isExternalVariant = !!variantCheckboxData.value?.find((item) => item === 'isExternalVariant');
  const isRegisteredVariant = !!variantCheckboxData.value?.find((item) => item === 'isRegisteredVariant');

  if (!isFormValid) {
    return;
  }

  const newVariantObject = reactive({
    taskId: variantFields.selectedGame.id,
    taskDescription: variantFields.selectedGame.description,
    taskImage: variantFields.selectedGame.image,
    variantName: variantFields.variantName,
    variantParams: variantParams,
    // TODO: Check if this is the valid way to see demo/test data values
    demoData: { task: !!variantFields.selectedGame?.demoData, variant: isDemoData },
    testData: { task: !!variantFields.selectedGame?.testData, variant: isTestData },
    registered: isRegisteredVariant,
  });

  // I don't think that this is necessary for variants anymore, commenting out for now
  // if (isExternalVariant) {
  //   const mappedVariantParams = Object.entries(variantParams.value).map(([key, value]) => ({ key, value }));
  //   console.log(mappedVariantParams.value)
  //   newVariantObject.variantParams = {
  //     ...variantParams,
  //     variantURL: buildTaskURL(variantFields.selectedGame?.taskURL || '', mappedVariantParams),
  //   };
  // }

  // Write variant to Db
  try {
    await authStore.roarfirekit.registerTaskVariant({ ...newVariantObject });

    toast.add({ severity: 'success', summary: 'Hoorah!', detail: 'Variant successfully created.', life: 3000 });

    submitted.value = false;

    resetVariantForm();
  } catch (error) {
    console.error(error);
  }
};

function convertParamsToObj(paramType) {
  return paramType.value.reduce((acc, item) => {
    if (item.name) {
      // Check if name is not empty
      acc[item.name] = item.value;
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

function resetVariantForm() {
  Object.assign(variantFields, {
    variantName: '',
    selectedGame: {},
    external: true,
  });

  variantParams.value = [
    {
      name: '',
      value: '',
      type: 'String',
    },
  ];
}
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

.dynamic-param-container {
}

#inputParamName {
  color: black;
  font-weight: bold;
}

#inputParamType {
  color: black;
  font-weight: bold;
}
</style>
