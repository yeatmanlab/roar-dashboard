<template>
  <Toast />
  <TabView>
    <TabPanel header="Register Task">
      <div v-if="!created" class="card">
          <h1 class="text-center">Register a new task</h1>
        <!-- <p class="login-title" align="left">Register for ROAR</p> -->
        <form @submit.prevent="handleNewTaskSubmit(!t$.$invalid)" class="p-fluid">
          <!-- Task name -->
          <div class="flex flex-column row-gap-3">
          <section class="form-section">
            <div class="p-input-icon-right">
              <label for="taskName">Task Name <span class="required">*</span></label>
              <InputText
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
              {{ t$.taskName.required.$message.replace("Value", "Task Name") }}
            </small>
          </section>
          <!-- Task ID -->
          <section class="form-section">
            <div class="p-input-icon-right">
              <label for="taskId">Task ID <span class="required">*</span></label>
              <InputText
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
              {{ t$.taskId.required.$message.replace("Value", "Task ID") }}
            </small>
          </section>
          <!--Task URL-->
          <section class="form-section">
            <div>
              <label for="taskURL">Task URL <span class="required">*</span></label>
              <InputText name="taskURL" v-model="t$.taskURL.$model" :class="{ 'p-invalid': t$.taskURL.$invalid && submitted }" aria-describedby="first-name-error"/>
              <span v-if="t$.taskURL.$error && submitted">
                <span v-for="(error, index) of t$.taskURL.$errors" :key="index">
                  <small class="p-error">{{ error.$message }}</small>
                </span>
              </span>
              <small v-else-if="(t$.taskURL.$invalid && submitted) || t$.taskURL.$pending.$response" class="p-error">
                {{ t$.taskURL.required.$message.replace("Value", "Task URL") }}
              </small>
            </div>
          </section>
          <!-- Cover Image -->
          <section class="form-section">
            <div>
              <label for="coverImage">Cover Image (URL)</label>
              <InputText name="coverImage" v-model="taskFields.coverImage" />
            </div>  
          </section>
          <!--Description-->
          <section class="form-section">
            <div class="p-input-icon-right">
              <label for="description">Description </label>
              <InputText v-model="taskFields.description" name="description" />
            </div>
          </section>
        </div>

          <h3 class="text-center">Parameters / Configuration</h3>

          <div v-for="(param, index) in taskParams" :key="index">
              <div class="flex gap-2 align-content-start flex-grow-0 params-container">
                  <InputText
                      v-model="param.name"
                      placeholder="Name"
                  />

                  <Dropdown v-model="param.type" :options="typeOptions" />

                  <InputText v-if="param.type === 'String'"
                      v-model="param.value"
                      placeholder="Value"
                  />

                  <Dropdown v-else-if="param.type === 'Boolean'"
                    v-model="param.value"
                    :options="[true, false]"
                  />

                  <InputNumber v-else-if="param.type === 'Number'"
                    v-model="param.value"
                    show-buttons
                  />
                  
                  <Button
                    icon="pi pi-trash"
                    @click="removeField(taskParams, index)"
                    class="p-button-danger delete-btn"
                  />
              </div>
          </div>

          <Button label="Add Field" @click="addField(taskParams)" class="p-button-success" />

          <div class="form-submit">
            <Button type="submit" label="Submit" class="submit-button" />
          </div>
        </form>
      </div>

      <div v-else>
          <h2>Your task has been created!</h2>
          <p>Redirect to this URL upon task completion. ParticipantId can be any string, completed should be set to true.</p>
          <p>roar.education/?participantId=[$PARTICIPANT_ID]&completed=[$BOOLEAN]</p>
      </div>
      </TabPanel>

      <TabPanel header="Register Variant">
        <div class="card">
          <form @submit.prevent="handleVariantSubmit(!v$.$invalid)" class="p-fluid">
            <h1 class="text-center">Register a new Variant</h1>

            <div class="flex flex-column row-gap-3">
              <section class="form-section">
                <label for="variant-fields">Select an Existing Task (Task ID) <span class="required">*</span></label>
                <Dropdown v-model="v$.selectedGame.$model" :options="registeredGames" optionLabel="id" placeholder="Select a Game" :class="{ 'p-invalid': v$.variantName.$invalid && submitted }" name="variant-fields"></Dropdown>
                <span v-if="v$.selectedGame.$error && submitted">
                  <span v-for="(error, index) of v$.selectedGame.$errors" :key="index">
                      <small class="p-error">{{ error.$message }}</small>
                    </span>
                  </span>
                <small v-else-if="(v$.selectedGame.$invalid && submitted) || v$.selectedGame.$pending.$response" class="p-error">
                  {{ v$.selectedGame.id.required.$message.replace("Value", "Task selection") }}
                </small>
              </section>

              <section class="form-section">
                  <div class="p-input-icon-right">
                    <label for="variantName">Variant Name <span class="required">*</span></label>
                    <InputText
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
                  <small v-else-if="(v$.variantName.$invalid && submitted) || v$.variantName.$pending.$response" class="p-error">
                    {{ v$.variantName.required.$message.replace("Value", "Variant Name") }}
                  </small>
              </section>
            </div>

            <h3 class="text-center">Parameters / Configuration</h3>

            <div v-for="(param, index) in variantParams" :key="index">
                <div class="flex gap-2 align-content-start flex-grow-0 params-container">
                  <InputText
                      v-model="param.name"
                      placeholder="Name"
                  />

                  <Dropdown v-model="param.type" :options="typeOptions" />

                  <InputText v-if="param.type === 'String'"
                      v-model="param.value"
                      placeholder="Value"
                  />

                  <Dropdown v-else-if="param.type === 'Boolean'"
                    v-model="param.value"
                    :options="[true, false]"
                  />

                  <InputNumber v-else-if="param.type === 'Number'"
                    v-model="param.value"
                    show-buttons
                  />

                  <Button
                    icon="pi pi-trash"
                    @click="removeField(variantParams, index)"
                    class="p-button-danger delete-btn"
                  />
                </div>
            </div>

            <Button label="Add Field" @click="addField(variantParams)" class="p-button-success" />

            <div class="form-submit">
                <Button type="submit" label="Submit" class="submit-button" />
            </div>
          </form>
        </div>
      </TabPanel> 
    </TabView>
  </template>
  
  <script setup>
  import { reactive, ref, watch, toRaw } from "vue";
  import { required, url } from "@vuelidate/validators";
  import { useVuelidate } from "@vuelidate/core";
  import { useAuthStore } from "@/store/auth";
  import _get from 'lodash/get'
  import _number from 'lodash/toNumber'
  import { storeToRefs } from 'pinia';
  import { useToast } from "primevue/usetoast";
  const toast = useToast();

  const authStore = useAuthStore()

  const { isFirekitInit } = storeToRefs(authStore);

  const registeredGames = ref([])
  
  watch(isFirekitInit, async (newValue, oldValue) => {
    const tasks = await authStore.roarfirekit.getTasks()
    registeredGames.value = tasks
  })


  const taskFields = reactive({
    taskName: "",
    taskURL: "",
    taskId: "",
    coverImage: "",
    description: "",
    // Based on type of account?
    external: true
  });

  const taskRules = {
    taskName: { required },
    taskURL: { required, url },
    taskId: { required }
  };

  const taskParams = ref([
    {
        name: '',
        value: '',
        type: 'String'
    },
  ]);

  const variantFields = reactive({
    variantName: "",
    selectedGame: {},
    // Based on type of account?
    external: true
  });

  const variantRules = {
    variantName: { required },
    selectedGame: { 
      id: { required } 
    }
  }

  const variantParams = ref([
      {
          name: '',
          value: '',
          type: 'String'
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

  const typeOptions = ['String', 'Number', 'Boolean']

 
  const t$ = useVuelidate(taskRules, taskFields);
  const v$ = useVuelidate(variantRules, variantFields);
  const submitted = ref(false);
  const created = ref(false)
  
  const handleNewTaskSubmit = async (isFormValid) => {
    submitted.value = true

    if (!isFormValid) {
      return;
    }

   // Write task variant to DB
   try {
      const res = await authStore.roarfirekit.registerTaskVariant({
        taskId: taskFields.taskId,
        taskName: taskFields.taskName,
        taskDescription: taskFields.description,
        taskImage: taskFields.coverImage,
        taskURL: buildTaskURL(taskFields.taskURL, taskParams),
        // variantName,
        // variantDescription,
        variantParams: convertParamsToObj(taskParams)
      })

      created.value = true
    } catch (error) {
      console.error(error)
    }
  };

  const handleVariantSubmit = async (isFormValid) => {
    submitted.value = true

    if (!isFormValid) {
      return;
    }

    // Write variant to Db
    try {
      const res = await authStore.roarfirekit.registerTaskVariant({
        taskId: variantFields.selectedGame.id,
        taskDescription: variantFields.selectedGame.description,
        taskImage: variantFields.selectedGame.image,
        variantName: variantFields.variantName,
        // variantDescription,
        variantParams: {...convertParamsToObj(variantParams), variantURL: buildTaskURL(variantFields.selectedGame?.taskURL || "", variantParams)}
      })

      toast.add({ severity: 'success', summary: 'Hoorah!', detail: 'Variant successfully created.', life: 3000 });

      submitted.value = false

      resetVariantForm()

    } catch (error) {
      console.error(error)
    }
  }

  function convertParamsToObj(paramType) {
    return paramType.value.reduce((acc, item) => {
        if (item.name) {  // Check if name is not empty
          acc[item.name] = item.value;
        }
        return acc;
    }, {});
  }

  function buildTaskURL(url, params) {
    const baseURL = url

    let queryParams = url.includes("/?") ? "" : "/?"

    params.value.forEach((param, i) => {
        if (param.name) {
            if (i === 0) {
                queryParams += `${param.name}=${param.value}`
            } else {
                queryParams += `&${param.name}=${param.value}`
            }
        }
    })

    const completeURL = baseURL + queryParams

    return completeURL
  }


  function resetVariantForm() {
    Object.assign(variantFields, {
      variantName: "",
      selectedGame: {},
      external: true
    })

    variantParams.value = [
      {
          name: '',
          value: '',
          type: 'String'
      },
    ]
  }
 
  </script>
  
  <style scoped>
  .submit-button {
    margin: auto;
    margin-top: 1rem;
    margin-bottom: .5rem;
    display: flex;
    background-color: #3db1f9;
    color: black;
    border: none;
    width: 11.75rem;
  }
  .submit-button:hover {
    background-color: #2b8ecb;
    color: black;
  }

  .delete-btn {
    padding: .8rem
  }

  .params-container {
    display: flex; 
    margin-bottom: 1rem;
  }
  </style>