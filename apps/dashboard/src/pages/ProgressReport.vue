<template>
  <ProgressReport :administration-id="administrationId" :org-type="orgType" :org-id="orgId" />
</template>

<script setup>
import ProgressReport from '@/containers/ProgressReport';

defineProps({
  administrationId: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
});
</script>
