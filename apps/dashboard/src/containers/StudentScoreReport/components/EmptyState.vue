<template>
  <EmptyState class="bg-white rounded border-2 border border-gray-100">
    <template #title>
      <i18n-t keypath="scoreReports.stillWorking">
        <template #firstName>
          {{ studentFirstName }}
        </template>
      </i18n-t>
    </template>
    <template #description>
      <i18n-t keypath="scoreReports.needOneComplete">
        <template #firstName>
          {{ studentFirstName }}
        </template>
      </i18n-t>
    </template>
    <template #action>
      <!-- TODO: Fix routing to always go back to overview -->
      <PvButton
        label="Back to overview "
        icon="pi pi-arrow-left"
        icon-pos="left"
        severity="secondary"
        data-html2canvas-ignore="true"
        @click="$router.go(-1)"
      />
    </template>
  </EmptyState>
</template>

<script setup>
import PvButton from 'primevue/button';
import EmptyState from '@/components/EmptyState.vue';

defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
});
</script>
