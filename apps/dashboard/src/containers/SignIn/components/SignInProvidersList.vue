<template>
  <div class="flex flex-column w-full align-content-center justify-content-center">
    <PvButton
      v-if="props.showGenericProviders || (props.showScopedProviders && props.availableProviders.includes('clever'))"
      class="flex h-1 m-1 w-full surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__clever-sso"
      @click="$emit('auth-clever')"
    >
      <div class="flex flex-row align-items-center w-full">
        <div class="flex justify-content-end w-5">
          <img src="@/assets/provider-clever-logo.svg" alt="The Clever Logo" class="flex p-1 provider-logo" />
        </div>
        <div class="flex justify-content-start w-full pl-3">
          <span>{{ $t('authSignIn.signInWith') }} Clever</span>
        </div>
      </div>
    </PvButton>

    <PvButton
      v-if="props.showGenericProviders || (props.showScopedProviders && props.availableProviders.includes('classlink'))"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__classlink-sso"
      @click="$emit('auth-classlink')"
    >
      <div class="flex flex-row align-items-center w-full">
        <div class="flex justify-content-end w-5">
          <img src="@/assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="flex p-1 provider-logo" />
        </div>
        <div class="flex justify-content-start w-full pl-3">
          <span>{{ $t('authSignIn.signInWith') }} ClassLink</span>
        </div>
      </div>
    </PvButton>

    <PvButton
      v-if="props.showGenericProviders || (props.showScopedProviders && props.availableProviders.includes('nycps'))"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__nycps-sso"
      @click="$emit('auth-nycps')"
    >
      <div class="flex flex-row align-items-center w-full">
        <div class="flex justify-content-end w-5">
          <img
            src="@/assets/provider-nycps-logo.jpg"
            alt="The NYC Public Schools Logo"
            class="flex p-1 provider-logo"
          />
        </div>
        <div class="flex justify-content-start w-full pl-3">
          <span>{{ $t('authSignIn.signInWith') }} NYCPS</span>
        </div>
      </div>
    </PvButton>

    <PvButton
      v-if="props.showScopedProviders && props.availableProviders.includes('google')"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__google-sso"
      @click="$emit('auth-google')"
    >
      <div class="flex flex-row align-items-center w-full">
        <div class="flex justify-content-end w-5">
          <img src="@/assets/provider-google-logo.svg" alt="The Google Logo" class="flex p-1 provider-logo" />
        </div>
        <div class="flex justify-content-start w-full pl-3">
          <span>{{ $t('authSignIn.signInWith') }} Google</span>
        </div>
      </div>
    </PvButton>
  </div>
</template>

<script setup>
import PvButton from 'primevue/button';

const props = defineProps({
  showGenericProviders: { type: Boolean, default: false },
  showScopedProviders: { type: Boolean, default: false },
  availableProviders: { type: Array, default: () => [] },
});

defineEmits(['auth-clever', 'auth-classlink', 'auth-nycps', 'auth-google']);
</script>

<style scoped>
.provider-button {
  border-radius: 3rem;
  height: 2.5rem;
  color: black !important;
}
.provider-logo {
  width: 3.5vh;
}
</style>
