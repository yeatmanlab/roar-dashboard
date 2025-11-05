<template>
  <div class="flex flex-column w-full align-content-center justify-content-center">
    <!-- Clever -->
    <PvButton
      v-if="showAll || (props.showScopedProviders && props.availableProviders.includes('clever'))"
      class="flex h-1 m-1 w-full surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__clever-sso"
      @click="$emit('auth-clever')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="CLEVER_LOGO" alt="The Clever Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} Clever</span>
      </div>
    </PvButton>

    <!-- ClassLink -->
    <PvButton
      v-if="showAll || (props.showScopedProviders && props.availableProviders.includes('classlink'))"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__classlink-sso"
      @click="$emit('auth-classlink')"
    >
      <div class="flex flex-row align-items-center w-full gap-2">
        <img :src="CLASSLINK_LOGO" alt="The ClassLink Logo" class="flex p-1 w-1" />
        <span>{{ $t('authSignIn.signInWith') }} ClassLink</span>
      </div>
    </PvButton>

    <!-- NYCPS -->
    <PvButton
      v-if="showAll || (props.showScopedProviders && props.availableProviders.includes('nycps'))"
      class="flex h-1 m-1 w-full text-black surface-0 border-200 border-1 border-round-md justify-content-center hover:border-primary hover:surface-ground provider-button"
      data-cy="sign-in__nycps-sso"
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
import { computed } from 'vue';

// ✅ Vite-resolved assets; place these in src/assets/
import CLEVER_LOGO from '@/assets/provider-clever-logo.svg';
import CLASSLINK_LOGO from '@/assets/provider-classlink-logo.png';
import NYCPS_LOGO from '@/assets/provider-nycps-logo.jpg';

const props = defineProps({
  showScopedProviders: { type: Boolean, default: false },
  availableProviders: { type: Array, default: () => [] },
});

// Default page: show all scoped providers (matches your old “generic” behavior)
const showAll = computed(() => (props.availableProviders?.length ?? 0) === 0);
defineEmits(['auth-clever', 'auth-classlink', 'auth-nycps']);
</script>
