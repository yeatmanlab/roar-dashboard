<template>
  <PvToast />
  <PvTabView>
    <PvTabPanel header="Register Task">
      <div v-if="!created" class="card px-3">
        <h1 class="text-center font-bold">Register a New Task</h1>
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
            <h3 class="text-center">Configure Task Parameters</h3>
            <h4 class="text-center">Create the configurable parameters for variants of this task.</h4>
            <div v-for="(param, index) in taskParams" :key="index">
              <div class="flex gap-2 align-content-start flex-grow-0 params-container">
                <PvInputText v-model="param.name" placeholder="Name" />

                <PvDropdown v-model="param.type" :options="typeOptions" />

                <PvInputText v-if="param.type === 'String'" v-model="param.value" placeholder="Value" />

                <PvDropdown v-else-if="param.type === 'Boolean'" v-model="param.value" :options="[true, false]" />

                <PvInputNumber v-else-if="param.type === 'Number'" v-model="param.value" show-buttons />

                <PvButton icon="pi pi-trash" class="delete-btn" text @click="removeField(taskParams, index)" />
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

                <PvInputText v-if="param.type === 'String'" v-model="param.value" placeholder="Value" />

                <PvDropdown v-else-if="param.type === 'Boolean'" v-model="param.value" :options="[true, false]" />

                <PvInputNumber v-else-if="param.type === 'Number'" v-model="param.value" show-buttons />

                <PvButton icon="pi pi-trash" text class="delete-btn" @click="removeField(taskParams, index)" />
              </div>
            </div>
          </div>

          <div class="w-full flex justify-content-end">
            <div class="w-2">
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

    <PvTabPanel header="Register Variant">
      <div class="card px-3">
        <form class="p-fluid" @submit.prevent="handleVariantSubmit(!v$.$invalid)">
          <h1 class="text-center font-bold">Register a New Variant</h1>

          <div class="flex flex-column row-gap-3">
            <section class="form-section">
              <div class="flex justify-content-between align-items-center">
                <label for="variant-fields">Select an Existing Task (Task ID) <span class="required">*</span></label>
                <div class="flex flex-column gap-2 align-items-end">
                  <div class="flex flex-row align-items-center justify-content-end gap-2 flex-order-1">
                    <label class="ml-7" for="chbx-registeredTask">Search registered tasks only?</label>
                    <PvCheckbox v-model="registeredTasksOnly" input-id="chbx-registeredTask" :binary="true" />
                  </div>
                </div>
              </div>
              <PvDropdown
                v-model="v$.selectedGame.$model"
                :options="tasks"
                option-label="id"
                placeholder="Select a Game"
                :loading="isFetchingTasks"
                :class="{ 'p-invalid': v$.variantName.$invalid && submitted }"
                name="variant-fields"
              ></PvDropdown>
              <span v-if="v$.selectedGame.$error && submitted">
                <span v-for="(error, index) of v$.selectedGame.$errors" :key="index">
                  <small class="p-error">{{ error.$message }}</small>
                </span>
              </span>
              <small
                v-else-if="(v$.selectedGame.$invalid && submitted) || v$.selectedGame.$pending.$response"
                class="p-error"
              >
                {{ v$.selectedGame.id.required.$message.replace('Value', 'Task selection') }}
              </small>
            </section>

            <section class="form-section">
              <div class="p-input-icon-right">
                <label for="variantName">Variant Name <span class="required">*</span></label>
                <PvInputText
                  v-model="v$.variantName.$model"
                  name="variantName"
                  :class="{ 'p-invalid': v$.variantName.$invalid && submitted }"
                  aria-describedby="activation-code-error"
                />
              </div>
              <span v-if="v$.variantName.$error && submitted">
                <span v-for="(error, index) of v$.variantName.$errors" :key="index">
                  <small class="p-error">{{ error.$message }}</small>
                </span>
              </span>
              <small
                v-else-if="(v$.variantName.$invalid && submitted) || v$.variantName.$pending.$response"
                class="p-error"
              >
                {{ v$.variantName.required.$message.replace('Value', 'Variant Name') }}
              </small>
            </section>
          </div>

          <h3 class="text-center">Parameters / Configuration</h3>

          <div v-for="(param, index) in variantParams" :key="index">
            <div class="flex gap-2 align-content-start flex-grow-0 params-container">
              <PvInputText v-model="param.name" placeholder="Name" />

              <PvDropdown v-model="param.type" :options="typeOptions" />

              <PvInputText v-if="param.type === 'String'" v-model="param.value" placeholder="Value" />

              <PvDropdown v-else-if="param.type === 'Boolean'" v-model="param.value" :options="[true, false]" />

              <PvInputNumber v-else-if="param.type === 'Number'" v-model="param.value" show-buttons />

              <PvButton icon="pi pi-trash" class="delete-btn" text @click="removeField(variantParams, index)" />
            </div>
          </div>

          <div class="w-full flex justify-content-end">
            <div class="w-2">
              <PvButton icon="pi pi-plus" label="Add Field" text @click="addField(variantParams)" />
            </div>
          </div>
          <div class="flex flex-row align-items-center justify-content-center gap-2 flex-order-0 my-3">
            <div class="flex flex-row align-items-center">
              <PvCheckbox
                v-model="variantCheckboxData"
                input-id="chbx-demoVariant"
                name="variantCheckboxData"
                value="isDemoVariant"
              />
              <label class="ml-1 mr-3" for="chbx-demoVariant">Mark as <b>Demo Variant</b></label>
            </div>
            <div class="flex flex-row align-items-center">
              <PvCheckbox
                v-model="variantCheckboxData"
                input-id="chbx-testVariant"
                name="variantCheckboxData"
                value="isTestVariant"
              />
              <label class="ml-1 mr-3" for="chbx-testVariant">Mark as <b>Test Variant</b></label>
            </div>
            <div class="flex flex-row align-items-center">
              <PvCheckbox
                v-model="variantCheckboxData"
                input-id="chbx-externalVariant"
                name="variantCheckboxData"
                value="isExternalVariant"
              />
              <label class="ml-1 mr-3" for="chbx-externalVariant">Mark as <b>External Variant</b></label>
            </div>
          </div>
          <div class="form-submit">
            <PvButton type="submit" label="Submit" class="submit-button" severity="primary" />
          </div>
        </form>
      </div>
    </PvTabPanel>
  </PvTabView>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue';
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
  configuration: {},
  // Based on type of account?
  external: true,
});

const taskRules = {
  taskName: { required },
  taskURL: { required: requiredIf(isExternalTask.value), url },
  taskId: { required },
  configuration: { required },
};

const taskConfig = ref({
  name: '',
  value: '',
  type: 'String',
});

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

const variantParams = ref([
  {
    name: '',
    value: '',
    type: 'String',
  },
]);

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

const typeOptions = ['String', 'Number', 'Boolean'];

const t$ = useVuelidate(taskRules, taskFields);
const v$ = useVuelidate(variantRules, variantFields);
const submitted = ref(false);
const created = ref(false);

const handleNewTaskSubmit = async (isFormValid) => {
  submitted.value = true;
  const isDemoData = !!taskCheckboxData.value?.find((item) => item === 'isDemoTask');
  const isTestData = !!taskCheckboxData.value?.find((item) => item === 'isTestTask');

  if (!isFormValid) {
    return;
  }

  const convertedParams = convertParamsToObj(taskParams);

  let newTaskObject = reactive({
    taskId: taskFields.taskId,
    taskName: taskFields.taskName,
    taskDescription: taskFields.description,
    taskImage: taskFields.coverImage,
    taskConfig: taskFields.configuration,
    variantParams: convertedParams,
    demoData: { task: isDemoData, variant: isDemoData },
    testData: { task: isTestData, variant: isTestData },
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
  const isExternalVariant = !!variantCheckboxData.value?.find((item) => item === 'isExternalVariant');

  if (!isFormValid) {
    return;
  }

  const convertedParams = convertParamsToObj(variantParams);

  const newVariantObject = reactive({
    taskId: variantFields.selectedGame.id,
    taskDescription: variantFields.selectedGame.description,
    taskImage: variantFields.selectedGame.image,
    variantName: variantFields.variantName,
    variantParams: convertedParams,
    // TODO: Check if this is the valid way to see demo/test data values
    demoData: { task: !!variantFields.selectedGame?.demoData, variant: isDemoData },
    testData: { task: !!variantFields.selectedGame?.testData, variant: isTestData },
  });

  if (isExternalVariant) {
    newVariantObject.variantParams = {
      ...convertedParams,
      variantURL: buildTaskURL(variantFields.selectedGame?.taskURL || '', variantParams),
    };
  }

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

.params-container {
  display: flex;
  margin-bottom: 1rem;
}
</style>
