<template>
  <AppSpinner />
</template>
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import AppSpinner from '@/components/AppSpinner.vue';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';

/**
 * SSO landing page.
 *
 * The identity provider redirects here after its OAuth consent step. The
 * component records which provider requested the sign-in and bounces to the
 * SignIn page, which re-triggers the corresponding AuthService flow on mount.
 * No firekit state is involved.
 */

const OAUTH_REQUEST_FLAGS = Object.freeze({
  [AUTH_SSO_PROVIDERS.CLEVER]: 'cleverOAuthRequested',
  [AUTH_SSO_PROVIDERS.CLASSLINK]: 'classLinkOAuthRequested',
  [AUTH_SSO_PROVIDERS.NYCPS]: 'nycpsOAuthRequested',
});

const props = defineProps({
  provider: {
    type: String,
    required: true,
    // defineProps is hoisted out of setup(), so the validator can only
    // reference imported bindings — not the local OAUTH_REQUEST_FLAGS map.
    validator: (value) =>
      [AUTH_SSO_PROVIDERS.CLEVER, AUTH_SSO_PROVIDERS.CLASSLINK, AUTH_SSO_PROVIDERS.NYCPS].includes(value),
  },
  code: { type: String, default: '' },
});

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  if (props.code) {
    authStore[OAUTH_REQUEST_FLAGS[props.provider]] = true;
    router.replace({ name: 'SignIn' });
  } else {
    router.push({ name: 'Home' });
  }
});
</script>
