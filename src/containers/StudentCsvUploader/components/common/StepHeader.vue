<template>
  <h2 class="step-header">{{ title }}</h2>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.step-header {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 2rem;
  color: var(--text-color);
}
</style>
