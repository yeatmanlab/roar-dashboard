<template>
  <div class="flex justify-content-between align-items-center">
    <div class="flex gap-2 mb-4 flex-column align-items-start">
      <div>
        <div class="font-light text-gray-500 uppercase text-md">{{ orgType }} Progress Report</div>
        <div class="uppercase text-5xl font-bold mt-0">
          {{ orgName }}
        </div>
      </div>
      <div>
        <div class="font-light text-gray-500 uppercase text-md">Administration</div>
        <div class="uppercase text-3xl font-light">
          {{ administrationName }}
        </div>
      </div>
    </div>
    <ViewSelector :model-value="reportView" :options="reportViews" @change="$emit('view-change')" />
  </div>
</template>

<script setup>
import ViewSelector from './ViewSelector.vue';

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
  reportView: {
    type: Object,
    required: true,
  },
  reportViews: {
    type: Array,
    required: true,
  },
});

defineEmits(['view-change']);
</script>
