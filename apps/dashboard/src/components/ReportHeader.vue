<template>
  <div class="flex justify-content-between align-items-start">
    <div class="flex gap-2 mb-1 flex-column align-items-start">
      <div>
        <div class="font-light text-gray-500 uppercase text-md">{{ orgType }} {{ reportType }} Report</div>
        <div class="uppercase font-bold mt-0 uppercase text-4xl">
          {{ orgName }}
        </div>
      </div>
      <div>
        <div class="font-light text-gray-500 uppercase text-md">Administration</div>
        <div class="mb-4 uppercase text-xl">
          {{ administrationName }}
        </div>
      </div>
    </div>

    <div class="flex gap-1 flex-column align-items-end flex-shrink-0">
      <!-- View Selector -->
      <div class="view-selector-container flex flex-row gap-3 align-items-center" data-html2canvas-ignore="true">
        <div class="view-label flex flex-row text-sm text-gray-600 uppercase">VIEW</div>
        <PvSelectButton
          v-tooltip.top="'View different report'"
          :model-value="reportView"
          :options="reportViews"
          option-disabled="constant"
          :allow-empty="false"
          option-label="name"
          class="flex my-2 select-button"
          @update:model-value="$emit('update:reportView', $event)"
          @change="$emit('view-change', $event)"
        />
      </div>

      <!-- Export Buttons Slot -->
      <slot name="export-buttons" />
    </div>
  </div>
</template>

<script setup>
import PvSelectButton from 'primevue/selectbutton';

defineProps({
  orgType: {
    type: String,
    required: true,
  },
  orgName: {
    type: String,
    default: '',
  },
  administrationName: {
    type: String,
    required: true,
  },
  reportType: {
    type: String,
    required: true,
    validator: (value) => ['Progress', 'Score'].includes(value),
  },
  reportView: {
    type: Object,
    required: true,
  },
  reportViews: {
    type: Array,
    required: true,
  },
});

defineEmits(['update:reportView', 'view-change']);
</script>

<style scoped>
.select-button :deep(.p-button:last-of-type:not(:only-of-type)) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 25rem;
  border-bottom-right-radius: 25rem;
}

.select-button :deep(.p-button:first-of-type:not(:only-of-type)) {
  border-top-left-radius: 25rem;
  border-bottom-left-radius: 25rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* Responsive: stack VIEW label on top of select button on narrow screens */
@media (max-width: 640px) {
  .view-selector-container {
    flex-direction: column !important;
    align-items: center !important;
    gap: 0rem !important;
  }
}
</style>
