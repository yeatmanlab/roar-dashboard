<template>
  <div>
    <!-- Modal version -->
    <PvDialog
      v-if="isModal"
      v-model:visible="isVisible"
      :modal="true"
      :style="{ width: '90vw', height: '90vh' }"
      :closable="true"
      @hide="$emit('close')"
    >
      <template #header>
        <h3 class="m-0">User Settings</h3>
      </template>
      <AdminProfile :is-modal="true" :target-user-id="targetUserId" />
    </PvDialog>

    <!-- Inline version -->
    <AdminProfile v-else :is-modal="false" :target-user-id="targetUserId" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AdminProfile from '@/pages/AdminProfile.vue';
import PvDialog from 'primevue/dialog';

const props = defineProps({
  isModal: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
  targetUserId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'close']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
</script>
