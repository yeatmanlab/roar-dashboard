<template>
  <Alert v-if="show" :variant="ALERT_VARIANTS.DESTRUCTIVE" class="w-full mb-2">
    <AlertTitle>{{ title }}</AlertTitle>
    <AlertDescription>
      <slot>{{ description }}</slot>
    </AlertDescription>
  </Alert>
</template>

<script setup>
import { Alert, AlertTitle, AlertDescription, ALERT_VARIANTS } from '@/components/Alert';
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
});
</script>
