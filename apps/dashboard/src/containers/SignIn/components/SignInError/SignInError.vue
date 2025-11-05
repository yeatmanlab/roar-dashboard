<template>
  <!-- Replaces PvMessage, but same “red error” vibe using your Alert -->
  <Alert v-if="show" variant="destructive" class="w-full mb-2">
    <AlertTitle>{{ title }}</AlertTitle>
    <AlertDescription>
      <slot>{{ description }}</slot>
    </AlertDescription>
  </Alert>
</template>

<script setup>
import { Alert, AlertTitle, AlertDescription } from '@/components/Alert';
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
});
</script>
