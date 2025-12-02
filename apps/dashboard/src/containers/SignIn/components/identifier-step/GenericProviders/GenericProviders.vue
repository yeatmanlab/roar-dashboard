<template>
  <div class="flex flex-column w-full align-content-center justify-content-center">
    <!-- Clever -->
    <ProviderButton
      class="flex h-1 m-1 w-full surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      :img-src="CLEVER_LOGO"
      :label="`${$t('authSignIn.signInWith')} Clever`"
      data-cy="sign-in__clever-sso"
      @click="$emit('auth-clever')"
    />

    <!-- ClassLink -->
    <ProviderButton
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      :img-src="CLASSLINK_LOGO"
      :label="`${$t('authSignIn.signInWith')} ClassLink`"
      data-cy="sign-in__classlink-sso"
      @click="$emit('auth-classlink')"
    />

    <!-- NYCPS -->
    <ProviderButton
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
import CLEVER_LOGO from '@/assets/provider-clever-logo.svg';
import CLASSLINK_LOGO from '@/assets/provider-classlink-logo.png';
import NYCPS_LOGO from '@/assets/provider-nycps-logo.jpg';

defineEmits(['auth-clever', 'auth-classlink', 'auth-nycps']);
</script>
