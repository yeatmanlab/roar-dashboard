<template>
  {{ variant.id }}
</template>
<script setup>
const props = defineProps({
  variant: {
    required: true,
    type: Object,
  },
  hasControls: {
    required: false,
    type: boolean,
    default: false,
  },
});
</script>
