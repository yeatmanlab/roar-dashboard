<template>
  <!-- allow-empty disabled: clicking the active option would otherwise set the model
       to null and hide both forms. -->
  <PvSelectButton
    v-model="viewModel"
    :options="Object.values(MODEL_VIEWS)"
    :allow-empty="false"
    class="flex my-2 select-button p-2"
  />

  <!-- v-show (not v-if) keeps both forms mounted so in-progress work — drafts, the status
       filter, and variant selection — survives view toggles. This is safe now because each
       form is its own component: vuelidate registers configurator rows only within that
       child's tree, so the old single-component cross-registration hazard no longer applies. -->
  <CreateVariantForm v-show="viewModel === MODEL_VIEWS.CREATE_VARIANT" v-model:selected-task-id="selectedTaskId" />

  <UpdateVariantForm v-show="viewModel === MODEL_VIEWS.UPDATE_VARIANT" v-model:selected-task-id="selectedTaskId" />

  <PvToast />
</template>

<script setup>
import { ref } from 'vue';
import PvSelectButton from 'primevue/selectbutton';
import PvToast from 'primevue/toast';
import CreateVariantForm from './components/CreateVariantForm.vue';
import UpdateVariantForm from './components/UpdateVariantForm.vue';

const MODEL_VIEWS = Object.freeze({
  CREATE_VARIANT: 'Create Variant',
  UPDATE_VARIANT: 'Update Variant',
});

const viewModel = ref(MODEL_VIEWS.CREATE_VARIANT);

// The task selection is shared between the two views: picking a task in one
// form pre-selects it in the other, so admins can create a variant and then
// immediately update one of the same task without re-selecting it.
const selectedTaskId = ref('');
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
