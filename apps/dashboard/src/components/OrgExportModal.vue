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
      <div class="flex align-items-center gap-2">
        <!-- Success icon -->
        <i
          v-if="exportComplete && exportSuccess"
          class="pi pi-check-circle text-green-500"
          style="font-size: 1.5rem"
        ></i>
        <!-- Cancelled icon -->
        <i
          v-else-if="exportComplete && exportCancelled"
          class="pi pi-ban text-orange-500"
          style="font-size: 1.5rem"
        ></i>
        <!-- Error icon -->
        <i
          v-else-if="exportComplete && !exportSuccess"
          class="pi pi-times-circle text-red-500"
          style="font-size: 1.5rem"
        ></i>
        <!-- Progress spinner -->
        <i v-else-if="exportInProgress" class="pi pi-spin pi-spinner text-blue-500" style="font-size: 1.5rem"></i>
        <!-- Warning icons -->
        <i
          v-else-if="exportWarningLevel === 'critical'"
          class="pi pi-exclamation-triangle text-orange-500"
          style="font-size: 1.5rem"
        ></i>
        <i
          v-else-if="exportWarningLevel === 'strong'"
          class="pi pi-exclamation-circle text-yellow-600"
          style="font-size: 1.5rem"
        ></i>
        <!-- Default info icon -->
        <i v-else class="pi pi-info-circle text-blue-500" style="font-size: 1.5rem"></i>
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
import PvDialog from 'primevue/dialog';
import PvMessage from 'primevue/message';
import PvButton from 'primevue/button';

defineProps({
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
</script>
