<template>
  <template>
    <PvDialog :visible="isOpen" modal @update:visible="emit('modalClosed')" style="width: 66vw">
      <template #header>
        <div class="modal-header gap-2">
          <i class="pi pi-pencil text-gray-400 modal-icon"></i>
          <div class="flex flex-column">
            <h1 class="modal-title admin-page-header">{{ title }}</h1>
            <span class="text-md text-gray-500">{{ subtitle }}</span>
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
</template>
<script setup>
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { fetchDocById } from '@/helpers/query/utils';
import { watch, ref, onMounted, computed } from 'vue';
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
});

// Handle modal opening / closing
const emit = defineEmits(['modalClosed']);

const authStore = useAuthStore();
const { roarfirekit, uid, userQueryKeyIndex } = storeToRefs(authStore);
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

const closeModal = () => {
  errorMessage.value = '';
  isOpen.value = false;
  emit('modalClosed');
};

const isOpen = ref(false);
const isSubmitting = ref(false);

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
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
