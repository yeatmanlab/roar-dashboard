<template>
  <PvButton
    type="button"
    class="mt-3 w-full p-0 bg-white text-500 border-500 hover:bg-primary hover:border-primary hover:text-white p-2"
    data-cy="signin-use-password"
    @click="$emit('back-to-password')"
  >
    <span>{{ $t('pageSignIn.usePassword') }}</span>
  </PvButton>
</template>

<script setup>
import PvButton from 'primevue/button';
defineEmits(['back-to-password']);
</script>
