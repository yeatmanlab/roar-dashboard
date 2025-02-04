<template>
  <PvDialog :visible="isOpen" modal style="width: 66vw" @update:visible="emit('modalClosed')">
    <template #header>
      <div v-if="!small" class="modal-header gap-2">
        <i class="pi text-gray-400 modal-icon" :class="icon"></i>
        <div class="flex flex-column">
          <h1 class="modal-title admin-page-header">{{ title }}</h1>
          <span class="text-md text-gray-500">{{ subtitle }}</span>
        </div>
      </div>
      <div v-else-if="small">
        <div class="modal-header">
          <i class="pi text-gray-400 modal-icon-small" :class="icon"></i>
          <div class="flex flex-column">
            <span class="text-lg font-bold text-gray-500">{{ title }}</span>
            <span class="text-sm text-gray-500">{{ subtitle }}</span>
          </div>
        </div>
      </div>
    </template>
    <slot></slot>
    <template #footer>
      <div class="modal-footer">
        <slot name="footer"></slot>
      </div>
    </template>
    <!-- </template> -->
  </PvDialog>
</template>
<script setup>
import { watch, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import PvDialog from 'primevue/dialog';
import { useAuthStore } from '@/store/auth';

const props = defineProps({
  isEnabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  title: {
    type: String,
    required: true,
    default: '',
  },
  subtitle: {
    type: String,
    required: true,
    default: '',
  },
  icon: {
    type: String,
    required: false,
    default: 'pi-pencil',
  },
  small: {
    type: Boolean,
    required: false,
    default: false,
  },
});

// Handle modal opening / closing
const emit = defineEmits(['modalClosed']);

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);

watch(
  () => props.isEnabled,
  (isEnabled) => {
    console.log('isEnabled from watcher', isEnabled);
    if (isEnabled) {
      isOpen.value = true;
    } else if (!isEnabled) {
      isOpen.value = false;
    }
  },
);

const isOpen = ref(false);

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit?.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value?.restConfig) init();
});
</script>
<style lang="scss">
.modal-header {
  margin-right: auto;
  display: flex;
  flex-direction: row;
}
.modal-icon {
  font-size: 1.6rem;
  margin-top: 6px;
}
.modal-icon-small {
  font-size: 1rem;
  margin-top: 4px;
  margin-right: 0.5rem;
}
.modal-title {
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.modal-footer {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  width: 100%;
  gap: 1rem;
  padding: 1.5rem;
  background-color: #e6e7eb;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
}
.p-dialog .p-dialog-footer {
  padding: 0;
}
</style>
