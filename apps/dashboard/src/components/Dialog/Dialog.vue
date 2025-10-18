<template>
  <PvDialog
    :visible="isOpen"
    :modal="modal"
    :draggable="draggable"
    :closable="closable"
    :close-on-escape="closeOnEscape"
    :style="dialogStyle"
    :class="dialogClass"
    @update:visible="handleVisibleChange"
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
import { ref, watch, onMounted, computed } from 'vue';
import PvDialog from 'primevue/dialog';

const props = defineProps({
  // Backward compatible with original isEnabled pattern
  isEnabled: {
    type: Boolean,
    required: false,
    default: undefined,
  },
  // New v-model:visible pattern
  visible: {
    type: Boolean,
    required: false,
    default: undefined,
  },
  // PrimeVue passthrough props with sensible defaults
  modal: {
    type: Boolean,
    default: true,
  },
  draggable: {
    type: Boolean,
    default: false,
  },
  closable: {
    type: Boolean,
    default: false,
  },
  closeOnEscape: {
    type: Boolean,
    default: false,
  },
  // Styling props
  width: {
    type: String,
    default: undefined,
  },
  dialogClass: {
    type: String,
    default: 'w-128',
  },
});

const emit = defineEmits(['modalClosed', 'update:visible']);

const isOpen = ref(false);

// Support both visible and isEnabled patterns
const computedVisible = computed(() => {
  // Prioritize visible prop if provided, otherwise fall back to isEnabled
  if (props.visible !== undefined) return props.visible;
  if (props.isEnabled !== undefined) return props.isEnabled;
  return false;
});

// Watch for changes in either prop
watch(
  computedVisible,
  (newValue) => {
    isOpen.value = !!newValue;
  },
  { immediate: true },
);

// Handle visibility changes from PvDialog
const handleVisibleChange = (value) => {
  isOpen.value = value;
  emit('update:visible', value);
  if (!value) {
    emit('modalClosed');
  }
};

// Compute dialog style
const dialogStyle = computed(() => {
  if (props.width) {
    return { width: props.width };
  }
  return undefined;
});

onMounted(() => {
  isOpen.value = !!computedVisible.value;
});
</script>

<style scoped>
:deep(.p-dialog .p-dialog-footer) {
  padding: 0;
}
</style>
