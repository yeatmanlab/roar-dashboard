<template>
  <PvDialog
    :visible="isOpen"
    modal
    style="width: 66vw"
    @update:visible="emit('modalClosed')"
  >
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
<script setup lang="ts">
import { watch, ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import PvDialog from "primevue/dialog";
import { useAuthStore } from "@/store/auth";

interface Props {
  isEnabled: boolean;
  title: string;
  subtitle: string;
  icon?: string;
  small?: boolean;
}

interface Emits {
  (e: "modalClosed"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isEnabled: false,
  title: "",
  subtitle: "",
  icon: "pi-pencil",
  small: false,
});

// Handle modal opening / closing
const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref<boolean>(false);

watch(
  () => props.isEnabled,
  (isEnabled: boolean) => {
    console.log("isEnabled from watcher", isEnabled);
    if (isEnabled) {
      isOpen.value = true;
    } else if (!isEnabled) {
      isOpen.value = false;
    }
  },
);

const isOpen = ref<boolean>(false);

let unsubscribe: (() => void) | undefined;
const init = (): void => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation: any, state: any) => {
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
