<template>
  <div class="flex py-3 justify-between">
    <Button v-if="previousStep" label="Back" severity="secondary" icon="pi pi-arrow-left" @click="previousClick" />
    <div v-else></div>

    <StepHeader :title="title" />

    <Button
      v-if="nextStep"
      label="Next"
      :disabled="disabled"
      icon="pi pi-arrow-right"
      icon-pos="right"
      @click="nextClick"
    />
    <div v-else></div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import Button from 'primevue/button';
import StepHeader from './StepHeader.vue';

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  previousStep: {
    type: String,
    default: '',
  },
  nextStep: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['previous', 'next']);

const previousClick = () => {
  emit('previous', props.previousStep);
};

const nextClick = () => {
  emit('next', props.nextStep);
};
</script>
