<template>
  <Card class="bg-white border border-round-xs border-200 p-3 shadow-1">
    <template #content>
      <slot />
    </template>
  </Card>
</template>

<script setup>
import Card from 'primevue/card';
</script>
