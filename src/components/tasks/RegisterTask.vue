<template>
    <div v-if="!submitted" class="card">
        <h1 class="text-center">Register a new task</h1>
      <!-- <p class="login-title" align="left">Register for ROAR</p> -->
      <form @submit.prevent="handleFormSubmit(!v$.$invalid)" class="p-fluid">
        <!-- Task name -->
        <section class="form-section">
          <div class="p-input-icon-right">
            <label for="taskName">Task Name <span class="required">*</span></label>
            <InputText
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
          <small v-else-if="(v$.taskName.$invalid && submitted) || v$.taskName.$pending.$response" class="p-error">
            {{ v$.taskName.required.$message.replace("Value", "Task Name") }}
          </small>
        </section>
        <!-- Task ID -->
        <section class="form-section">
          <div class="p-input-icon-right">
            <label for="taskId">Task ID <span class="required">*</span></label>
            <InputText
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
            {{ v$.taskId.required.$message.replace("Value", "Task ID") }}
          </small>
        </section>
        <!--Task URL-->
        <section class="form-section">
          <div>
            <label for="taskURL">Task URL <span class="required">*</span></label>
            <InputText name="taskURL" v-model="v$.taskURL.$model" :class="{ 'p-invalid': v$.taskURL.$invalid && submitted }" aria-describedby="first-name-error"/>
            <span v-if="v$.taskURL.$error && submitted">
              <span v-for="(error, index) of v$.taskURL.$errors" :key="index">
                <small class="p-error">{{ error.$message }}</small>
              </span>
            </span>
            <small v-else-if="(v$.taskURL.$invalid && submitted) || v$.taskURL.$pending.$response" class="p-error">
              {{ v$.taskURL.required.$message.replace("Value", "Task URL") }}
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

        <div v-for="(param, index) in params" :key="index">
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
                    @click="removeField(index)"
                    class="p-button-danger"
                />
            </div>
        </div>

        <Button label="Add Field" @click="addField" class="p-button-success" />

        <div class="form-submit">
          <Button type="submit" label="Submit" class="submit-button" />
        </div>
      </form>
    </div>

    <div v-else>
        <h2>Your task has been created!</h2>
        <p>Redirect to this URL upon task completion. ParticipantId can be any stringm, completed should be true.</p>
        <p>roar.education/?participantId=[$PARTICIPANT_ID]&completed=[$BOOLEAN]</p>
    </div>

  </template>
  
  <script setup>
  import { computed, reactive, ref, toRaw, watch } from "vue";
  import { required, sameAs, minLength, } from "@vuelidate/validators";
  import { useVuelidate } from "@vuelidate/core";
  import { useRouter } from "vue-router";
  import { useAuthStore } from "@/store/auth";
  import { isMobileBrowser } from "@/helpers";
  import _get from 'lodash/get'
  import Message from 'primevue/message';

  const router = useRouter()
  const authStore = useAuthStore()

  const taskFields = reactive({
    taskName: "",
    taskURL: "",
    taskId: "",
    coverImage: "",
    description: "",
  });

    const rules = {
        taskName: { required },
        taskURL: { required },
        taskId: { required }
    };

    const params = ref([
        {
            name: '',
            value: '',
        },
    ]);


  function addField() {
    params.value.push({
        name: '',
        value: '',
    });
  }

    function removeField(index) {
        params.value.splice(index, 1);
    }

 
  const v$ = useVuelidate(rules, taskFields);
  const submitted = ref(false);
  
  const handleFormSubmit = (isFormValid) => {
    if (!isFormValid) {
      return;
    }
    submitted.value = true

    const completeTaskURL = buildTaskURL()

    // Write task variant to DB

  };

  function buildTaskURL() {
    const baseURL = taskFields.taskURL

    let queryParams = "/?"

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