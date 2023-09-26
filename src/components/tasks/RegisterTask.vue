<template>
  <TabView>
    <TabPanel header="Register Game">
      <div v-if="!submitted" class="card">
          <h1 class="text-center">Register a new task</h1>
        <!-- <p class="login-title" align="left">Register for ROAR</p> -->
        <form @submit.prevent="handleNewTaskSubmit(!t$.$invalid)" class="p-fluid">
          <!-- Task name -->
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
            <!-- Cover Image -->
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

          <h3 class="text-center">Parameters / Configuration</h3>

          <div v-for="(param, index) in taskParams" :key="index">
              <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                  <InputText
                      v-model="param.name"
                      placeholder="Name"
                      style="margin-right: 1rem;"
                  />
                  <InputText
                      v-model="param.value"
                      placeholder="Value"
                      style="margin-right: 1rem;"
                  />
                  <Button
                      label="Remove"
                      @click="removeField(taskParams, index)"
                      class="p-button-danger"
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

            <label>Select an Existing Game (Task ID)</label>
            <Dropdown v-model="selectedGame" :options="registeredGames" optionLabel="id" placeholder="Select a Game" ></Dropdown>

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
                  {{ v$.variantName.required.$message.replace("Value", "Task Name") }}
                </small>
            </section>

            <h3 class="text-center">Parameters / Configuration</h3>

            <div v-for="(param, index) in taskParams" :key="index">
                <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                    <InputText
                        v-model="param.name"
                        placeholder="Name"
                        style="margin-right: 1rem;"
                    />
                    <InputText
                        v-model="param.value"
                        placeholder="Value"
                        style="margin-right: 1rem;"
                    />
                    <Button
                        label="Remove"
                        @click="removeField(variantParams, index)"
                        class="p-button-danger"
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
  import { computed, reactive, ref, toRaw, watch, } from "vue";
  import { required, } from "@vuelidate/validators";
  import { useVuelidate } from "@vuelidate/core";
  import { useAuthStore } from "@/store/auth";
  import _get from 'lodash/get'
  import { storeToRefs } from 'pinia';

  const authStore = useAuthStore()

  const { roarfirekit, firekitUserData, isFirekitInit } = storeToRefs(authStore);

  const selectedGame = ref();
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
    taskURL: { required },
    taskId: { required }
  };

  const taskParams = ref([
    {
        name: '',
        value: '',
    },
  ]);

  const variantFields = reactive({
    variantName: "",
    // Based on type of account?
    external: true
  });

  const variantRules = {
    variantName: { required }
  }

  const variantParams = ref([
      {
          name: '',
          value: '',
      },
  ]);


  function addField(type) {
    type.value.push({
        name: '',
        value: '',
    });
  }

  function removeField(type, index) {
      type.value.splice(index, 1);
  }

 
  const t$ = useVuelidate(taskRules, taskFields);
  const v$ = useVuelidate(variantRules, variantFields);
  const submitted = ref(false);
  
  const handleNewTaskSubmit = async (isFormValid) => {
    console.log(toRaw(t$._value.$error));
    console.log(toRaw(t$._value.$errors));
    console.log(toRaw(t$._value.$invalid));

    console.log(toRaw(authStore.roarfirekit))

    if (!isFormValid) {
      return;
    }
    submitted.value = true

    console.log('params as object: ', convertParamsToObj(taskParams))

    console.log('task URL: ', taskFields.taskURL)

   // Write task variant to DB
   try {
      const res = await authStore.roarfirekit.registerTaskVariant({
        taskId: taskFields.taskId,
        taskName: taskFields.taskName,
        taskDescription: taskFields.description,
        taskImage: taskFields.coverImage,
        taskURL: buildTaskURL(),
        // variantName,
        // variantDescription,
        variantParams: convertParamsToObj(taskParams)
      })

      console.log({res})
    } catch (error) {
      console.error(error)
    }
  };

  const handleVariantSubmit = async (isFormValid) => {
    console.log('Selected game', toRaw(selectedGame.value))

    console.log('params as object: ', convertParamsToObj(variantParams))

    if (!isFormValid) {
      return;
    }

    // Write variant to Db
    try {
      const res = await authStore.roarfirekit.registerTaskVariant({
        taskId: selectedGame.id,
        taskName: variantFields,
        taskDescription: selectedGame.description,
        taskImage: selectedGame.image,
        taskURL: selectedGame?.taskURL,
        // variantName,
        // variantDescription,
        variantParams: convertParamsToObj(taskParams)
      })

      console.log({res})
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

  function buildTaskURL() {
    const baseURL = taskFields.taskURL

    let queryParams = "/?"

    taskParams.value.forEach((param, i) => {
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
  </style>