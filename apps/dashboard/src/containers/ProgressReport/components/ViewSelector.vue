<template>
  <div class="flex flex-row gap-4 align-items-center">
    <div class="text-sm text-gray-600 uppercase">VIEW</div>
    <PvSelectButton
      v-tooltip.top="'View different report'"
      :model-value="modelValue"
      :options="options"
      option-disabled="constant"
      :allow-empty="false"
      option-label="name"
      class="flex my-2 select-button"
      @update:model-value="$emit('update:modelValue', $event)"
      @change="$emit('change', $event)"
    />
  </div>
</template>

<script setup>
import PvSelectButton from 'primevue/selectbutton';

defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
});

defineEmits(['update:modelValue', 'change']);
</script>

<style scoped>
.select-button :deep(.p-button:last-of-type:not(:only-of-type)) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 25rem;
  border-bottom-right-radius: 25rem;
}

.select-button :deep(.p-button:first-of-type:not(:only-of-type)) {
  border-top-left-radius: 25rem;
  border-bottom-left-radius: 25rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
