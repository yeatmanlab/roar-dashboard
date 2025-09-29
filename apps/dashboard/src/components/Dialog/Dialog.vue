<template>
  <PvDialog
    :visible="isOpen"
    :modal="true"
    :draggable="false"
    :closable="false"
    :close-on-escape="false"
    class="w-128"
    @update:visible="emit('modalClosed')"
  >
    <template #header>
      <slot name="header" />
    </template>

    <slot />

    <template #footer>
      <slot name="footer"></slot>
    </template>
  </PvDialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import PvDialog from 'primevue/dialog';

const props = defineProps({
  isEnabled: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const emit = defineEmits(['modalClosed']);

const isOpen = ref(false);

watch(
  () => props.isEnabled,
  (isEnabled) => {
    isOpen.value = !!isEnabled;
  },
  { immediate: true },
);

onMounted(() => {
  isOpen.value = !!props.isEnabled;
});
</script>

<style scoped>
:deep(.p-dialog .p-dialog-footer) {
  padding: 0;
}
</style>
