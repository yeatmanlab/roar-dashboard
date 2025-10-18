<template>
  <PvDialog
    :visible="visible"
    :style="{ width: '40rem' }"
    :draggable="false"
    :closable="!exportInProgress"
    modal
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <i :class="['pi', status.icon, status.color, status.spin, 'text-2xl']" role="img" :aria-label="status.aria" />
        <h2 class="m-0 font-bold">{{ title }}</h2>
      </div>
    </template>
    <PvMessage :severity="severity" :closable="false" class="mb-3">
      <div style="white-space: pre-line">{{ message }}</div>
    </PvMessage>
    <template #footer>
      <div class="flex justify-content-end gap-2">
        <!-- Show only Close button when complete -->
        <PvButton
          v-if="exportComplete"
          label="Close"
          severity="primary"
          class="border-none border-round p-2"
          @click="$emit('cancel')"
        />
        <!-- Show Cancel button during export -->
        <PvButton
          v-else-if="exportInProgress"
          label="Cancel Export"
          severity="danger"
          outlined
          class="border-none border-round p-2"
          @click="$emit('request-cancel')"
        />
        <!-- Show Cancel and Continue buttons before export starts -->
        <template v-else>
          <PvButton
            label="Cancel"
            severity="secondary"
            outlined
            class="border-none border-round p-2"
            @click="$emit('cancel')"
          />
          <PvButton
            :label="exportWarningLevel === 'critical' ? 'Export Anyway' : 'Continue Export'"
            :severity="exportWarningLevel === 'critical' ? 'danger' : 'primary'"
            class="border-none border-round p-2"
            @click="$emit('confirm')"
          />
        </template>
      </div>
    </template>
  </PvDialog>
</template>

<script setup>
import { computed } from 'vue';
import PvDialog from 'primevue/dialog';
import PvMessage from 'primevue/message';
import PvButton from 'primevue/button';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  exportInProgress: {
    type: Boolean,
    required: true,
  },
  exportComplete: {
    type: Boolean,
    required: true,
  },
  exportSuccess: {
    type: Boolean,
    required: true,
  },
  exportCancelled: {
    type: Boolean,
    required: true,
  },
  exportWarningLevel: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    required: true,
  },
});

defineEmits(['update:visible', 'confirm', 'cancel', 'request-cancel']);

/**
 * Computed property for status icon configuration
 */
const status = computed(() => {
  if (props.exportComplete && props.exportSuccess) {
    return {
      icon: 'pi-check-circle',
      color: 'text-green-500',
      aria: 'Export successful',
    };
  }
  if (props.exportComplete && props.exportCancelled) {
    return {
      icon: 'pi-ban',
      color: 'text-orange-500',
      aria: 'Export cancelled',
    };
  }
  if (props.exportComplete && !props.exportSuccess) {
    return {
      icon: 'pi-times-circle',
      color: 'text-red-500',
      aria: 'Export failed',
    };
  }
  if (props.exportInProgress) {
    return {
      icon: 'pi-spinner',
      color: 'text-blue-500',
      spin: 'pi-spin',
      aria: 'Export in progress',
    };
  }
  if (props.exportWarningLevel === 'critical') {
    return {
      icon: 'pi-exclamation-triangle',
      color: 'text-orange-500',
      aria: 'Critical warning',
    };
  }
  if (props.exportWarningLevel === 'strong') {
    return {
      icon: 'pi-exclamation-circle',
      color: 'text-yellow-600',
      aria: 'Warning',
    };
  }
  return {
    icon: 'pi-info-circle',
    color: 'text-blue-500',
    aria: 'Information',
  };
});
</script>
