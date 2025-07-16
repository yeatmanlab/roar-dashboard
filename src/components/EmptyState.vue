<template>
  <div class="px-4 py-8 mt-2 text-center">
    <h2 v-if="$slots.title" class="text-xl font-bold text-gray-600">
      <slot name="title" />
    </h2>
    <p v-if="$slots.description" class="text-gray-400 text-md">
      <slot name="description" />
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
