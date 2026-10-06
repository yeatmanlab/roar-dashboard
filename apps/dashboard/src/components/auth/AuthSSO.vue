<template>
  <AppSpinner />
</template>
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import AppSpinner from '@/components/AppSpinner.vue';
import { AUTH_SSO_OAUTH_REQUEST_FLAGS } from '@/constants/auth';
import { APP_ROUTE_NAMES } from '@/constants/routes';

/**
 * SSO landing page.
 *
 * The identity provider redirects here after its OAuth consent step. The
 * component records which provider requested the sign-in and bounces to the
 * SignIn page, which re-triggers the corresponding AuthService flow on mount.
 * No firekit state is involved.
 */

const props = defineProps({
  provider: {
    type: String,
    required: true,
    // defineProps is hoisted out of setup(), so the validator can only
    // reference imported bindings — the map import above qualifies. Deriving
    // the valid providers from the map keeps the validator and the flag
    // lookup below from drifting apart.
    validator: (value) => Object.keys(AUTH_SSO_OAUTH_REQUEST_FLAGS).includes(value),
  },
  code: { type: String, default: '' },
});

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  // The lookup can miss when a provider is added to AUTH_SSO_PROVIDERS but
  // not to AUTH_SSO_OAUTH_REQUEST_FLAGS — the prop validator only warns in
  // dev, so guard here to avoid writing a garbage key onto the auth store.
  const oauthRequestFlag = AUTH_SSO_OAUTH_REQUEST_FLAGS[props.provider];

  if (props.code && oauthRequestFlag) {
    authStore[oauthRequestFlag] = true;
    router.replace({ name: APP_ROUTE_NAMES.SIGN_IN });
  } else {
    router.push({ name: APP_ROUTE_NAMES.HOME });
  }
});
</script>
