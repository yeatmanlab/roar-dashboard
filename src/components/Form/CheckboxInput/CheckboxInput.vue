<template>
  <label
    :for="id"
    class="flex flex-row align-items-center gap-2 p-3 lg:p-0 lg:py-1 lg:bg-white bg-gray-100 rounded"
    data-testid="checkboxinput"
  >
    <PvCheckbox
      v-model="model"
      :input-id="id"
      :binary="true"
      :pt="{
        root: {
          'data-testid': 'checkboxinput__input-wrapper',
        },
        box: {
          'data-testid': 'checkboxinput__input-box',
        },
      }"
    />
    <span v-if="$slots.default" data-testid="checkboxinput__label">
      <slot />
    </span>
    <span v-else data-testid="checkboxinput__label">
      {{ label }}
    </span>
  </label>
</template>

<script setup>
import { nanoid } from 'nanoid';
import PvCheckbox from 'primevue/checkbox';

const model = defineModel({ required: true, type: Boolean });

defineProps({
  id: {
    type: String,
    default: () => `checkbox-${nanoid()}`,
  },
  label: {
    type: String,
    default: null,
  },
});
</script>

<style scoped>
label {
  cursor: pointer;
}
</style>
