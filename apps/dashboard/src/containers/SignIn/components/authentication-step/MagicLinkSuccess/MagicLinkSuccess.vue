<template>
  <div class="flex flex-column align-items-center text-center gap-2">
    <h2 class="text-xl font-semibold">{{ $t('pageSignIn.checkInbox') }}</h2>
    <p class="text-500">{{ $t('pageSignIn.checkInboxDescription') }}</p>
    <PvButton
      class="mt-3 w-full p-2 bg-white text-500 border-500 hover:bg-primary hover:border-primary hover:text-white"
      type="button"
      data-cy="signin-use-password"
      @click="$emit('back-to-password')"
    >
      <span>{{ $t('pageSignIn.usePassword') }}</span>
    </PvButton>
  </div>
</template>

<script setup>
import PvButton from 'primevue/button';
defineEmits(['back-to-password']);
</script>
