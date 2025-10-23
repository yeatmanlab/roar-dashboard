<template>
  <Dialog
    :visible="visible"
    width="40rem"
    :closable="exportPhase !== EXPORT_PHASE.IN_PROGRESS"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <i :class="['pi', status.icon, status.color, status.spin, 'text-2xl']" role="img" :aria-label="status.aria" />
        <h2 class="m-0 font-bold">{{ title }}</h2>
      </div>
    </template>
    <PvMessage :severity="severity" :closable="false" class="mb-3">
      <div class="whitespace-pre-line">{{ message }}</div>
    </PvMessage>
    <template #footer>
      <div class="flex justify-content-end gap-2">
        <!-- Show only Close button when complete -->
        <PvButton
          v-if="
            exportPhase === EXPORT_PHASE.SUCCESS ||
            exportPhase === EXPORT_PHASE.FAILED ||
            exportPhase === EXPORT_PHASE.CANCELLED
          "
          label="Close"
          severity="primary"
          class="border-none border-round p-2"
          @click="$emit('cancel')"
        />
        <!-- Show Cancel button during export -->
        <PvButton
          v-else-if="exportPhase === EXPORT_PHASE.IN_PROGRESS"
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
            :label="exportWarningLevel === WARNING_LEVELS.CRITICAL ? 'Export Anyway' : 'Continue Export'"
            :severity="exportWarningLevel === WARNING_LEVELS.CRITICAL ? 'danger' : 'primary'"
            class="border-none border-round p-2"
            @click="$emit('confirm')"
          />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue';
import Dialog from '@/components/Dialog';
import PvMessage from 'primevue/message';
import PvButton from 'primevue/button';
import { EXPORT_PHASE, WARNING_LEVELS } from '@/containers/OrgsList/constants/exportConstants';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  exportPhase: {
    type: String,
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
 * Computed property for status icon configuration based on export phase
 */
const status = computed(() => {
  switch (props.exportPhase) {
    case EXPORT_PHASE.SUCCESS:
      return {
        icon: 'pi-check-circle',
        color: 'text-green-500',
        aria: 'Export successful',
      };
    case EXPORT_PHASE.CANCELLED:
      return {
        icon: 'pi-ban',
        color: 'text-orange-500',
        aria: 'Export cancelled',
      };
    case EXPORT_PHASE.FAILED:
      return {
        icon: 'pi-times-circle',
        color: 'text-red-500',
        aria: 'Export failed',
      };
    case EXPORT_PHASE.IN_PROGRESS:
      return {
        icon: 'pi-spinner',
        color: 'text-blue-500',
        spin: 'pi-spin',
        aria: 'Export in progress',
      };
    case EXPORT_PHASE.IDLE:
      if (props.exportWarningLevel === WARNING_LEVELS.CRITICAL) {
        return {
          icon: 'pi-exclamation-triangle',
          color: 'text-orange-500',
          aria: 'Critical warning',
        };
      }
      if (props.exportWarningLevel === WARNING_LEVELS.STRONG) {
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
    default:
      return {
        icon: 'pi-info-circle',
        color: 'text-blue-500',
        aria: 'Information',
      };
  }
});
</script>
