<template>
  <div class="w-full flex justify-content-center align-items-center mb-8 mt-0 pt-0">
    <PvChip
      :label="email"
      class="flex justify-content-center align-items-center"
      :image="USER_ICON_IMAGE_PATH"
      removable
      @remove="$emit('remove')"
    />
  </div>
</template>

<script setup>
import PvChip from 'primevue/chip';
import { USER_ICON_IMAGE_PATH } from '@/constants/auth';
defineProps({ email: { type: String, required: true } });
defineEmits(['remove']);
</script>
