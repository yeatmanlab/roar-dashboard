<template>
  <HomeParticipant :launch-id="participantId" />
</template>

<script setup>
import HomeParticipant from '@/pages/HomeParticipant.vue';

const props = defineProps({
  participantId: { type: String, required: false, default: null },
});
</script>
