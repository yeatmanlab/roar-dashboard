<template>
  <div class="flex flex-column row-gap-4">
    <div v-for="(param, index) in model" :key="index">
      <div class="flex gap-2 align-content-start flex-grow-0 params-container">
        <PvInputText v-model="param.name" placeholder="Name" />

        <PvDropdown v-model="param.type" :options="typeOptions" />

        <PvInputText v-if="param.type === TASK_PARAMETER_TYPES.STRING" v-model="param.value" placeholder="Value" />

        <PvDropdown
          v-else-if="param.type === TASK_PARAMETER_TYPES.BOOLEAN"
          v-model="param.value"
          :options="[true, false]"
          placeholder="Select"
        />

        <PvInputNumber v-else-if="param.type === TASK_PARAMETER_TYPES.NUMBER" v-model="param.value" placeholder="0" />

        <PvButton
          icon="pi pi-trash"
          text
          class="delete-btn bg-primary text-white border-none border-round p-2 px-3 hover:bg-red-900"
          @click="removeRow(index)"
        />
      </div>
    </div>

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
import PvButton from 'primevue/button';
import PvDropdown from 'primevue/dropdown';
import PvInputNumber from 'primevue/inputnumber';
import PvInputText from 'primevue/inputtext';
import { TASK_PARAMETER_TYPES, TASK_PARAMETER_DEFAULT_SHAPE } from '@/constants/tasks';

const typeOptions = Object.values(TASK_PARAMETER_TYPES);

const model = defineModel({
  required: true,
  type: Array,
});

/**
 * Add a new row to the configurator.
 *
 * @returns {void}
 */
function addRow() {
  model.value.push(Object.assign({}, TASK_PARAMETER_DEFAULT_SHAPE));
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
