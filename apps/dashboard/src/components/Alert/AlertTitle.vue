<template>
  <h5 :class="cn('mt-0 mb-2 text-base font-medium leading-none tracking-tight', props.class)">
    <slot />
  </h5>
</template>

<script setup>
import { cn } from '@/utils';

const props = defineProps({
  class: { type: null, required: false, default: null },
});
</script>
