<template>
  <div class="flex flex-column w-full align-content-center justify-content-center">
    <!-- Google -->
    <ProviderButton
      v-if="availableProviders.includes('google')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      :img-src="GOOGLE_LOGO"
      :label="`${$t('authSignIn.signInWith')} Google`"
      data-cy="sign-in__google-sso"
      @click="$emit('auth-google')"
    />

    <!-- Clever -->
    <ProviderButton
      v-if="showAllDistrict || availableProviders.includes('clever')"
      class="flex h-1 m-1 w-full surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      :img-src="CLEVER_LOGO"
      :label="`${$t('authSignIn.signInWith')} Clever`"
      data-cy="sign-in__clever-sso"
      @click="$emit('auth-clever')"
    />

    <!-- ClassLink -->
    <ProviderButton
      v-if="showAllDistrict || availableProviders.includes('classlink')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      :img-src="CLASSLINK_LOGO"
      :label="`${$t('authSignIn.signInWith')} ClassLink`"
      data-cy="sign-in__classlink-sso"
      @click="$emit('auth-classlink')"
    />

    <!-- NYCPS -->
    <ProviderButton
      v-if="showAllDistrict || availableProviders.includes('nycps')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      :img-src="NYCPS_LOGO"
      :label="`${$t('authSignIn.signInWith')} NYCPS`"
      data-cy="sign-in__nycps-sso"
      @click="$emit('auth-nycps')"
    />
  </div>
</template>

<script setup>
import ProviderButton from '@/containers/SignIn/components/shared/ProviderButton/ProviderButton.vue';
import GOOGLE_LOGO from '@/assets/provider-google-logo.svg';
import CLEVER_LOGO from '@/assets/provider-clever-logo.svg';
import CLASSLINK_LOGO from '@/assets/provider-classlink-logo.png';
import NYCPS_LOGO from '@/assets/provider-nycps-logo.jpg';

defineProps({
  // e.g. ['google','clever','classlink','nycps']
  availableProviders: { type: Array, default: () => [] },

  // When true, always show the three district providers
  // regardless of `availableProviders` (home screen).
  showAllDistrict: { type: Boolean, default: false },
});

defineEmits(['auth-google', 'auth-clever', 'auth-classlink', 'auth-nycps']);
</script>
