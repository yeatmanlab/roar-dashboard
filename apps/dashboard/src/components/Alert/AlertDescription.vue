<template>
  <div :class="cn('text-sm [&_p]:leading-relaxed', props.class)">
    <slot />
  </div>
</template>

<script setup>
import { cn } from '@/utils';

const props = defineProps({
  class: { type: null, required: false, default: null },
});
</script>
