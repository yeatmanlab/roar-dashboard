<template>
  <header class="flex flex-row gap-3 mb-5">
    <i :class="`pi pi-${icon} text-gray-400 leading-7`" style="font-size: 1.625rem" />

    <div>
      <h1 class="m-0 mb-1 font-bold text-gray-600">{{ title }}</h1>
      <div class="text-md text-gray-500">{{ description }}</div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
/* @TODO: Remove in favour of Tailwind class once yeatmanlab/roar-project-management/issues/321 is resolved */
h1 {
  font-size: 1.65rem;
}
</style>
