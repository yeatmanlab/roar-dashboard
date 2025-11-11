<template>
  <RoarModal
    :is-enabled="modelValue"
    title="Forgot Password"
    subtitle="Enter your email to reset your password"
    small
    @modal-closed="$emit('update:modelValue', false)"
  >
    <template #default>
      <div class="flex flex-column gap-2">
        <label for="forgot-email" class="text-600 text-sm">Email</label>
        <PvInputText id="forgot-email" :model-value="email" @update:model-value="$emit('update:email', $event)" />
      </div>
    </template>

    <template #footer>
      <PvButton
        tabindex="0"
        class="p-2 bg-white border-none border-round text-primary hover:surface-200"
        text
        label="Cancel"
        outlined
        @click="$emit('update:modelValue', false)"
      />
      <PvButton
        tabindex="0"
        class="p-2 text-white border-none border-round bg-primary hover:surface-400"
        label="Send Reset Email"
        @click="$emit('submit')"
      />
    </template>
  </RoarModal>
</template>

<script setup>
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import RoarModal from '@/components/modals/RoarModal.vue';

defineProps({
  modelValue: { type: Boolean, default: false }, // open/close
  email: { type: String, default: '' },
});
defineEmits(['update:modelValue', 'update:email', 'submit']);
</script>
