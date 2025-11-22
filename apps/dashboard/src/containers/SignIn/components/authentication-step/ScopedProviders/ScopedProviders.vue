<template>
  <div class="flex flex-column w-full align-content-center justify-content-center">
    <!-- Google -->
    <PvButton
      v-if="availableProviders.includes('google')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__google-sso"
      @click="$emit('auth-google')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="GOOGLE_LOGO" alt="The Google Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} Google</span>
      </div>
    </PvButton>

    <!-- Clever -->
    <PvButton
      v-if="availableProviders.includes('clever')"
      class="flex h-1 m-1 w-full surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__clever-sso-scoped"
      @click="$emit('auth-clever')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="CLEVER_LOGO" alt="The Clever Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} Clever</span>
      </div>
    </PvButton>

    <!-- ClassLink -->
    <PvButton
      v-if="availableProviders.includes('classlink')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__classlink-sso-scoped"
      @click="$emit('auth-classlink')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="CLASSLINK_LOGO" alt="The ClassLink Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} ClassLink</span>
      </div>
    </PvButton>

    <!-- NYCPS -->
    <PvButton
      v-if="availableProviders.includes('nycps')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__nycps-sso-scoped"
      @click="$emit('auth-nycps')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="NYCPS_LOGO" alt="The NYC Public Schools Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} NYCPS</span>
      </div>
    </PvButton>
  </div>
</template>

<script setup>
import PvButton from 'primevue/button';
import GOOGLE_LOGO from '@/assets/provider-google-logo.svg';
import CLEVER_LOGO from '@/assets/provider-clever-logo.svg';
import CLASSLINK_LOGO from '@/assets/provider-classlink-logo.png';
import NYCPS_LOGO from '@/assets/provider-nycps-logo.jpg';

defineProps({
  availableProviders: { type: Array, default: () => [] },
});

defineEmits(['auth-google', 'auth-clever', 'auth-classlink', 'auth-nycps']);
</script>
