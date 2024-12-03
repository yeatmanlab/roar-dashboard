<template>
  <label :for="id" class="flex flex-row align-items-center gap-2 p-3 lg:p-0 lg:py-1 lg:bg-white bg-gray-100 rounded">
    <PvCheckbox v-model="model" :input-id="id" :binary="true" />
    <slot v-if="$slots.default">
      <slot />
    </slot>
    <template v-else>{{ label }}</template>
  </label>
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
label {
  cursor: pointer;
}
</style>
