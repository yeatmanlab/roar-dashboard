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
                <label for="variant-fields">Select an Existing Task <span class="required">*</span></label>
                <div class="flex flex-column gap-2 align-items-end">
                  <div class="flex flex-row align-items-center justify-content-end gap-2 flex-order-1">
                    <!--                    This does not seemt to function properly, comming it out for now.-->
                    <!--                    <label class="ml-7" for="chbx-registeredTask">Search registered tasks only?</label>-->
                    <!--                    <PvCheckbox v-model="registeredTasksOnly" input-id="chbx-registeredTask" :binary="true" />-->
                  </div>
                </div>
              </div>
              <PvDropdown
                v-model="v$.selectedGame.$model"
                :options="tasks"
                option-label="name"
                placeholder="Select a Game"
                :loading="isFetchingTasks"
                :class="{ 'p-invalid': v$.variantName.$invalid && submitted }"
                name="variant-fields"
                @click="clearFieldParamArrays()"
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

                  <PvInputText id="inputParamName" v-model="variantParams[param.name]" :value="param.name" disabled />
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
                    class="flex-grow-1"
                  />
                  <PvDropdown
                    v-else-if="param.type === 'boolean'"
                    id="inputParamValue"
                    v-model="variantParams[param.name]"
                    :options="booleanDropDownOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Set game parameter to desired value"
                    class="flex-grow-1"
                  />
                  <PvInputNumber
                    v-else-if="param.type === 'number'"
                    id="inputParamValue"
                    v-model="variantParams[param.name]"
                    placeholder="Set game parameter to desired value"
                    class="flex-grow-1"
                  />
                </div>

                <div>
                  <PvButton type="button" @click="moveToDeletedParams(param.name)">Delete</PvButton>
                </div>
              </div>

              <div v-if="newParams.length > 0" class="w-full">
                <div v-for="(field, index) in newParams" :key="index" class="flex align-items-center column-gap-2 mb-1">
                  <PvInputText v-model="field.name" placeholder="Field Name" />
                  <PvDropdown
                    v-model="field.type"
                    :options="['string', 'number', 'boolean']"
                    placeholder="Field Type"
                    class="flex-grow-1"
                  />

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
                  <PvButton type="button" class="w-2" @click="removeField(field.name, newParams)">Delete</PvButton>
                </div>
              </div>
            </div>
            <PvButton label="Add Param" text icon="pi pi-plus" class="w-2 m-auto my-4" @click="newParam" />
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

    <PvTabPanel header="Update Variant">
      <h1 class="text-center font-bold">Update a Variant</h1>
      <form @submit.prevent="handleUpdateVariant">
        <section class="flex flex-column gap-2 mb-4">
          <label for="variant-fields" class="my-2"
            >Select an Existing Task and Variant <span class="required">*</span></label
          >
          <PvDropdown
            v-model="selectedTask"
            :options="tasks"
            option-label="name"
            option-value="id"
            placeholder="Select a Game"
            @click="clearFieldParamArrays()"
          />
          <PvDropdown
            v-model="selectedVariant"
            :options="filteredVariants"
            :option-label="(data) => (data.variant.name ? data.variant.name : data.variant.id)"
            option-value="variant"
            placeholder="Select a Variant"
            @click="clearFieldParamArrays()"
          />
        </section>

        <section v-if="selectedVariant" class="flex flex-column align-items-start mt-4">
          <div class="flex flex-column w-full">
            <label for="fieldsOutput">
              <strong>Fields</strong>
            </label>
            <div v-for="(value, key) in selectedVariant" id="fieldsOutput" :key="key">
              <div v-if="!ignoreFields.includes(key)">
                <div
                  v-if="updatedVariantData[key] !== undefined"
                  class="flex align-items-center justify-content-between gap-2 mb-1"
                >
                  <label :for="key" class="w-1">
                    <em>{{ key }}</em>
                  </label>
                  <PvInputText id="inputEditVariantType" :placeholder="typeof value" disabled class="text-right" />
                  <PvInputText
                    v-if="typeof value === 'string'"
                    v-model="updatedVariantData[key]"
                    :placeholder="value"
                    class="flex-grow-1"
                  />
                  <PvInputNumber
                    v-else-if="typeof value === 'number'"
                    v-model="updatedVariantData[key]"
                    class="flex-grow-1"
                  />
                  <PvDropdown
                    v-else-if="typeof value === 'boolean'"
                    v-model="updatedVariantData[key]"
                    :options="booleanDropDownOptions"
                    option-label="label"
                    option-value="value"
                    class="flex-grow-1"
                  />
                  <PvButton type="button" @click="deleteParam(key)">Delete</PvButton>
                </div>
              </div>
            </div>

            <div v-if="addedFields.length > 0" class="w-full">
              <div v-for="(field, index) in addedFields" :key="index" class="flex align-items-center column-gap-2 mb-1">
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
                <PvButton type="button" @click="removeField(field.name, addedFields)">Delete</PvButton>
              </div>
            </div>
          </div>
          <PvButton label="Add Field" text icon="pi pi-plus" class="my-4" @click="addField" />

          <!--          **** Disabling the function to edit game params for now ****-->

          <!--          <div class="flex flex-column w-8">-->
          <!--            <label for="paramsOutput">-->
          <!--              <strong>Game Params</strong>-->
          <!--            </label>-->
          <!--            <div v-for="(param, paramName) in selectedVariant.params" id="paramsOutput" :key="paramName" class="mb-1">-->
          <!--              <div-->
          <!--                v-if="updatedVariantData.params[paramName] !== undefined"-->
          <!--                class="flex align-items-center justify-content-end column-gap-2"-->
          <!--              >-->
          <!--                <label :for="paramName" class="w-2">-->
          <!--                  <em>{{ paramName }} </em>-->
          <!--                </label>-->
          <!--                <PvInputText id="inputEditParamType" :placeholder="typeof param" class="w-2" disabled />-->
          <!--                <PvInputText-->
          <!--                  v-if="typeof param === 'string'"-->
          <!--                  v-model="updatedVariantData.params[paramName]"-->
          <!--                  :placeholder="param"-->
          <!--                  class="flex-grow-1"-->
          <!--                />-->
          <!--                <PvInputNumber-->
          <!--                  v-else-if="typeof param === 'number'"-->
          <!--                  v-model="updatedVariantData.params[paramName]"-->
          <!--                  class="flex-grow-1"-->
          <!--                />-->
          <!--                <PvDropdown-->
          <!--                  v-else-if="typeof param === 'boolean'"-->
          <!--                  v-model="updatedVariantData.params[paramName]"-->
          <!--                  :options="booleanDropDownOptions"-->
          <!--                  option-label="label"-->
          <!--                  option-value="value"-->
          <!--                  class="flex-grow-1"-->
          <!--                />-->
          <!--                <PvButton type="button" @click="deleteParam(paramName)">Delete</PvButton>-->
          <!--              </div>-->
          <!--            </div>-->
          <!--            <div v-if="addedParams.length > 0">-->
          <!--              <div v-for="(field, index) in addedParams" :key="index" class="flex align-items-center column-gap-2 mb-1">-->
          <!--                <PvInputText v-model="field.name" placeholder="Field Name" />-->
          <!--                <PvDropdown v-model="field.type" :options="['string', 'number', 'boolean']" placeholder="Field Type" />-->
          <!--                <PvInputText-->
          <!--                  v-if="field.type === 'string'"-->
          <!--                  v-model="field.value"-->
          <!--                  placeholder="Field Value"-->
          <!--                  class="flex-grow-1"-->
          <!--                />-->
          <!--                <PvInputNumber-->
          <!--                  v-if="field.type === 'number'"-->
          <!--                  v-model="field.value"-->
          <!--                  placeholder="Field Value"-->
          <!--                  class="flex-grow-1"-->
          <!--                />-->
          <!--                <PvDropdown-->
          <!--                  v-if="field.type === 'boolean'"-->
          <!--                  v-model="field.value"-->
          <!--                  placeholder="Field Value"-->
          <!--                  :options="booleanDropDownOptions"-->
          <!--                  option-label="label"-->
          <!--                  option-value="value"-->
          <!--                  class="flex-grow-1"-->
          <!--                />-->
          <!--                <PvButton type="button" @click="removeField(field.name, addedParams)">Delete</PvButton>-->
          <!--              </div>-->
          <!--            </div>-->
          <!--          </div>-->
          <!--          <PvButton label="Add Param" text icon="pi pi-plus" class="my-4" @click="addParam" />-->
        </section>

        <PvButton type="submit" class="my-4">Update Variant</PvButton>
      </form>
    </PvTabPanel>
  </PvTabView>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { required } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { taskFetcher } from '@/helpers/query/tasks';
import { variantsFetcher } from '../../helpers/query/tasks';
import { cloneDeep } from 'lodash';

const toast = useToast();
const initialized = ref(false);
const registeredTasksOnly = ref(true);
const variantCheckboxData = ref();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const selectedTask = ref(null);
const selectedVariant = ref(null);
// Reactive clone for holding changes made to variantData without affecting the original variantData and avoiding reactivity issues
let updatedVariantData = reactive(cloneDeep(selectedVariant.value));
// Array of objects which models the new fields added to the variant
// This array of objects is later converted back into an object and spread into the updatedVariantData object
let addedFields = reactive([]);

// Array of objects which models the new params added to the variant
// This array of objects is later converted back into an object and spread into the updatedVariantData object
// let addedParams = reactive([]);
// Array of objects which models the new params added to the variant to be created
// This array of objects is later converted back into an object and spread into the variantParams object

let newParams = reactive([]);

// Fields to ignore when displaying variant data
const ignoreFields = ['id', 'lastUpdated', 'params', 'parentDoc'];

const booleanDropDownOptions = [
  { label: 'true', value: true },
  { label: 'false', value: false },
];

watch(selectedVariant, (newVal) => {
  updatedVariantData = reactive(cloneDeep(newVal));
});

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

// Filter variants based on selected task
const filteredVariants = computed(() => {
  if (!allVariants.value || !selectedTask.value) {
    return [];
  }

  return allVariants.value.filter((variant) => variant.task.id === selectedTask.value);
});

// Fields for modeling  a new variant
const variantFields = reactive({
  variantName: '',
  selectedGame: {},
  // Based on type of account?
  external: true,
});

// Validation rules for variantFields
const variantRules = {
  variantName: { required },
  selectedGame: {
    id: { required },
  },
};
const v$ = useVuelidate(variantRules, variantFields);
const submitted = ref(false);

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

// Filter out any deleted params when updating game configuration for the variant
const filteredMappedGameConfig = computed(() => {
  if (!mappedGameConfig.value) {
    return [];
  }

  return mappedGameConfig.value.filter((param) => !deletedParams.value.includes(param.name));
});

// Keep track of params that are not needed for the particular variant when creating a new variant
const deletedParams = ref([]);

// Push the name of the param to the deletedParams array,
// Triggering a computation of the filteredMappedGameConfig and variantParams
const moveToDeletedParams = (param) => {
  deletedParams.value.push(param);
};

// Delete the param from the updatedVariantData object when updating a variant
const deleteParam = (param) => {
  if (updatedVariantData['params'][param] !== undefined) {
    delete updatedVariantData['params'][param];
  }
  delete updatedVariantData[param];
};

// Add a new field to the updatedVariantData object when updating a variant
const addField = () => {
  addedFields.push({ name: '', value: '', type: 'string' });
};

// Remove a field from the addedFields array when updating a variant
const removeField = (field, array) => {
  const updatedFields = array.filter((item) => item.name !== field);
  array.splice(0, array.length, ...updatedFields);
};

// Add a new param to the updatedVariantData object when updating a variant
// const addParam = () => {
//   addedParams.push({ name: '', value: '', type: 'string' });
// };

// Add a new param to the newParams array when creating a new variant
const newParam = () => {
  newParams.push({ name: '', value: '', type: 'string' });
};

// Convert an array of paramType objects into a single object
function convertParamsToObj(paramType) {
  return paramType.reduce((acc, item) => {
    if (item.name) {
      // Check if name is not empty
      acc[item.name] = item.value;
    }
    return acc;
  }, {});
}

const handleUpdateVariant = async () => {
  const convertedFields = convertParamsToObj(addedFields);
  // const convertedParams = convertParamsToObj(addedParams);
  const updateData = {
    taskId: selectedTask.value,
    variantId: selectedVariant.value.id,
    data: {
      ...updatedVariantData,
      ...convertedFields,
      // params: {
      //   ...updatedVariantData.params,
      //   ...convertedParams,
      // },
    },
  };

  try {
    await authStore.roarfirekit.updateTaskOrVariant(updateData);
    toast.add({ severity: 'success', summary: 'Hoorah!', detail: 'Variant successfully updated.', life: 3000 });

    resetUpdateVariantForm();
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

  const convertedParams = convertParamsToObj(newParams);

  const combinedParams = {
    ...variantParams.value,
    ...convertedParams,
  };

  const newVariantObject = reactive({
    taskId: variantFields.selectedGame.id,
    taskDescription: variantFields.selectedGame.description,
    taskImage: variantFields.selectedGame.image,
    variantName: variantFields.variantName,
    variantParams: combinedParams,
    // TODO: Check if this is the valid way to see demo/test data values
    demoData: { task: !!variantFields.selectedGame?.demoData, variant: isDemoData },
    testData: { task: !!variantFields.selectedGame?.testData, variant: isTestData },
    registered: isRegisteredVariant,
  });

  try {
    await authStore.roarfirekit.registerTaskVariant({ ...newVariantObject });

    toast.add({ severity: 'success', summary: 'Hoorah!', detail: 'Variant successfully created.', life: 3000 });

    submitted.value = false;

    resetCreateVariantForm();
  } catch (error) {
    console.error(error);
  }
};

function resetCreateVariantForm() {
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

  variantCheckboxData.value = [];
  clearFieldParamArrays();
}

const resetUpdateVariantForm = () => {
  selectedTask.value = null;
  selectedVariant.value = null;
  updatedVariantData = {};
  clearFieldParamArrays();
};

const clearFieldParamArrays = () => {
  addedFields = reactive([]);
  // addedParams = reactive([]);
  newParams = reactive([]);
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
</style>
