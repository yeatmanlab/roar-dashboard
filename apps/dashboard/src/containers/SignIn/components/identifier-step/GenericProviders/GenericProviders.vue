<template>
  <div class="flex flex-column w-full align-content-center justify-content-center">
    <PvButton
      v-if="props.showGenericProviders || (props.showScopedProviders && props.availableProviders.includes('google'))"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__google-sso"
      @click="$emit('auth-google')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="GOOGLE_LOGO" alt="The Google Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} Google</span>
      </div>
    </PvButton>
  </div>
</template>

<script setup>
import PvButton from 'primevue/button';
import GOOGLE_LOGO from '@/assets/provider-google-logo.svg';

const props = defineProps({
  showGenericProviders: { type: Boolean, default: false },
  showScopedProviders: { type: Boolean, default: false },
  availableProviders: { type: Array, default: () => [] },
});
defineEmits(['auth-google']);
</script>
