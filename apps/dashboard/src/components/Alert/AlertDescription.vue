<template>
  <div :class="cn('text-sm [&_p]:leading-relaxed', props.class)">
    <slot />
  </div>
</template>

<script setup>
import { cn } from '@/utils';

const props = defineProps({
  class: { type: String, required: false, default: null },
});
</script>
