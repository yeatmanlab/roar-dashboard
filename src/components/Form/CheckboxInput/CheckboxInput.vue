<template>
  <div class="flex flex-row align-items-center">
    <PvCheckbox v-model="model" :input-id="id" :binary="true" />
    <label :for="id" class="ml-1 mr-3">
      <slot v-if="$slots.default">
        <slot></slot>
      </slot>
      <template v-else>{{ label }}</template>
    </label>
  </div>
</template>

<script setup>
import PvCheckbox from 'primevue/checkbox';

const model = defineModel();

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: false,
  },
});
</script>

<style scoped>
.p-checkbox + label {
  cursor: pointer;
}
</style>
