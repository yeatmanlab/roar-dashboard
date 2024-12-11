<template>
  <div class="flex flex-column row-gap-4">
    <template v-for="(param, index) in model" :key="index">
      <TaskParametersConfiguratorRow v-model="model" :row-index="index" :edit-mode="editMode" @remove-row="removeRow" />
    </template>

    <PvButton
      text
      class="p-3 text-primary border-none border-round transition-colors bg-gray-100 hover:bg-red-900 hover:text-white"
      @click="addRow()"
    >
      <div class="w-full flex justify-content-center gap-2 text-md">
        <i class="pi pi-plus" />
        <span>Add Parameter</span>
      </div>
    </PvButton>
  </div>
</template>

<script setup>
import { watch } from 'vue';
import useVuelidate from '@vuelidate/core';
import PvButton from 'primevue/button';
import TaskParametersConfiguratorRow from './TaskParametersConfiguratorRow.vue';
import { TASK_PARAMETER_DEFAULT_SHAPE } from '@/constants/tasks';

const model = defineModel({
  required: true,
  type: Array,
});

defineProps({
  editMode: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const v$ = useVuelidate({}, { model });

// watch model value changes
watch(
  model.value,
  async () => {
    const isFormValid = await v$.value.$validate();
    console.log('model valid', isFormValid);
  },
  { deep: true },
);

/**
 * Add a new row to the configurator.
 *
 * @returns {void}
 */
function addRow() {
  model.value.push(Object.assign({}, TASK_PARAMETER_DEFAULT_SHAPE, { isNew: true }));
}

/**
 * Remove a row from the configurator.
 *
 * @param {Int} index – The index of the field to be removed.
 * @returns {void}
 */
function removeRow(index) {
  model.value.splice(index, 1);
}
</script>
