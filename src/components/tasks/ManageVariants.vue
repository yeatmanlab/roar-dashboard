<template>
  <PvToast />
  <PvTabView>
    <PvTabPanel header="Create Variant">
      <div class="card px-3">
        <form class="p-fluid" @submit.prevent="handleVariantSubmit(!v$.$invalid)">
          <h1 class="text-center font-bold">Create a New Variant</h1>

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

          <div class="flex flex-column align-items-center">
            <h3 class="text-center">Configure Game Parameters</h3>
            <h4 class="text-center">
              Set the game parameters for a new variant of task <strong>{{ variantFields.selectedGame.id }}</strong>
            </h4>
            <div class="flex flex-column gap-4 mb-2">
              <!--
            Each param looks like this:
            {"name": "someParam", "type": "string, boolean, or number", "value": "valueOfParam"}

            We want to assign the value of param.name to the value of the equivalent key in variantParams

            So if param.name is "someParam", then
            variantParams[param.name] returns the value of variantParams.someParam,which is the value that we want to change for a new variant
-->
              <div
                v-for="(param, index) in filteredMappedGameConfig"
                :key="index"
                class="flex align-items-center justify-content-center dynamic-param-container gap-4"
              >
                <div class="flex align-items-center">
                  <label for="inputParamName">Parameter:</label>
                  <div class="inputTextDisabledWrapper">
                    <PvInputText id="inputParamName" v-model="variantParams[param.name]" :value="param.name" disabled />
                  </div>
                </div>

                <div class="flex align-items-center">
                  <label for="inputParamType">Type:</label>
                  <PvInputText id="inputParamType" v-model="param.type" :value="param.type" disabled />
                </div>

                <div class="flex align-items-center gap-2 flex-grow-1">
                  <label for="inputParamValue">Value:</label>
                  <PvInputText
                    v-if="param.type === 'string'"
                    id="inputParamValue"
                    v-model="variantParams[param.name]"
                    placeholder="Set game parameter to desired value"
                  />
                  <PvDropdown
                    v-else-if="param.type === 'boolean'"
                    id="inputParamValue"
                    v-model="variantParams[param.name]"
                    :options="booleanDropDownOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Set game parameter to desired value"
                  />
                  <PvInputNumber
                    v-else-if="param.type === 'number'"
                    id="inputParamValue"
                    v-model="variantParams[param.name]"
                    placeholder="Set game parameter to desired value"
                    button-layout="vertical"
                    show-buttons
                    style="width: 3em"
                  />
                </div>

                <div>
                  <button type="button" @click="deleteParam(param.name)">Delete</button>
                </div>
              </div>
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
              <!--              Not sure that we still have any need to mark a variant as external -->
              <!--              <PvCheckbox-->
              <!--                v-model="variantCheckboxData"-->
              <!--                input-id="chbx-externalVariant"-->
              <!--                name="variantCheckboxData"-->
              <!--                value="isExternalVariant"-->
              <!--              />-->
              <!--              <label class="ml-1 mr-3" for="chbx-externalVariant">Mark as <b>External Variant</b></label>-->
              <div class="flex flex-row align-items-center">
                <PvCheckbox
                  v-model="variantCheckboxData"
                  input-id="chbx-registeredVariant"
                  name="variantCheckboxData"
                  value="isRegisteredVariant"
                />
                <label class="ml-1 mr-3" for="chbx-externalVariant">Mark as <b>Registered Variant</b></label>
              </div>
            </div>
          </div>
          <div class="form-submit">
            <PvButton type="submit" label="Submit" class="submit-button" severity="primary" />
          </div>
        </form>
      </div>
    </PvTabPanel>

    <PvTabPanel header="Edit Variant">
      <form>
        <PvDropdown v-model="selectedTask" :options="tasks" option-label="name" option-value="id" />
      </form>
    </PvTabPanel>
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
import { variantsFetcher } from '../../helpers/query/tasks';

const toast = useToast();
const initialized = ref(false);
const registeredTasksOnly = ref(true);
const taskCheckboxData = ref();
const variantCheckboxData = ref();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const selectedTask = ref(null);

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

const { data: allVariants } = useQuery({
  queryKey: ['variants', 'all'],
  queryFn: () => variantsFetcher(),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

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

const booleanDropDownOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
];

const v$ = useVuelidate(variantRules, variantFields);
const submitted = ref(false);

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
