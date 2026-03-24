<template>
  <div class="flex flex-column align-items-center gap-3" data-cy="app-message-state">
    <img :src="imageSrc" aria-hidden class="w-32" />
    <h2 class="m-0" data-cy="app-message-state__title">{{ title }}</h2>
    <p v-if="message" class="m-0 mb-3 text-color-secondary" data-cy="app-message-state__message">{{ message }}</p>
    <slot name="actions" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { MESSAGE_STATE_TYPES, TYPE_IMAGES } from '.';

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    default: 'empty',
    validator: (value) => Object.values(MESSAGE_STATE_TYPES).includes(value),
  },
});

const imageSrc = computed(() => TYPE_IMAGES[props.type]);
</script>
