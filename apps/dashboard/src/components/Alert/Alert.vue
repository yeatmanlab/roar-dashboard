<template>
  <div :class="cn(alertVariants({ variant }), props.class)" role="alert">
    <div class="flex-shrink-0 mt-0.5 mr-3">
      <slot name="icon">
        <template v-if="variant === ALERT_VARIANTS.DESTRUCTIVE">
          <i class="pi pi-exclamation-circle"></i>
        </template>
        <template v-else-if="variant === ALERT_VARIANTS.SUCCESS">
          <i class="pi pi-check-circle"></i>
        </template>
        <template v-else>
          <i class="pi pi-info-circle"></i>
        </template>
      </slot>
    </div>
    <div class="flex flex-column">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { alertVariants, ALERT_VARIANTS } from '.';
import { cn } from '@/utils';

const props = defineProps({
  class: { type: null, required: false, default: null },
  variant: { type: null, required: false, default: 'default' },
});
</script>
