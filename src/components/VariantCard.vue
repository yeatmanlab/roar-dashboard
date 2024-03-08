<template>
  <div class="flex-1 flex flex-column gap-2">
    <span class="font-bold" style="margin-left: 0.625rem">{{ task.name }}</span>
    <div class="flex align-items-center gap-2">
      <i class="pi pi-tag text-sm" style="margin-left: 0.625rem"></i>
      <p>Variant: {{ variant.name }}</p>
      <p>Id: {{ variant.id }}</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  variant: {
    required: true,
    type: Object,
  },
  hasControls: {
    required: false,
    type: Boolean,
    default: false,
  },
});
</script>
