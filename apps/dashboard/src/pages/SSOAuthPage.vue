<template>
  <div
    class="flex flex-column align-items-center justify-content-center w-full min-h-screen-minus-nav"
    data-cy="sso-auth-page"
  >
    <!-- Error state: max retries exceeded -->
    <AppMessageState
      v-if="hasError"
      :type="MESSAGE_STATE_TYPES.ERROR"
      :title="$t('ssoAuth.errorTitle')"
      :message="$t('ssoAuth.errorMessage')"
      data-cy="sso-auth-page__error-state"
    >
      <template #actions>
        <div class="flex gap-2">
          <PvButton :label="$t('ssoAuth.retryButton')" data-cy="sso-auth-page__retry-btn" @click="retryPolling" />
          <PvButton
            :label="$t('ssoAuth.signOutButton')"
            severity="secondary"
            data-cy="sso-auth-page__signout-btn"
            @click="handleSignOut"
          />
        </div>
      </template>
    </AppMessageState>

    <!-- Loading state -->
    <div v-else class="text-center" data-cy="sso-auth-page__loading-state">
      <AppSpinner style="margin-bottom: 1rem" />
      <span v-if="isClassLinkProvider">{{ $t('classLinkLanding.classLinkLoading') }}</span>
      <span v-if="isCleverProvider">{{ $t('cleverLanding.cleverLoading') }}</span>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import { useAuthStore } from '@/store/auth';
import useSSOAccountReadinessVerification from '@/composables/useSSOAccountReadinessVerification';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import useSentryLogging from '@/composables/useSentryLogging';
import AppSpinner from '@/components/AppSpinner.vue';
import { AppMessageState, MESSAGE_STATE_TYPES } from '@/components/AppMessageState';
import { AUTH_SSO_PROVIDERS } from '../constants/auth';
import { AUTH_LOG_MESSAGES } from '../constants/logMessages';

const authStore = useAuthStore();
const { ssoProvider } = storeToRefs(authStore);

const { startPolling, hasError, retryPolling } = useSSOAccountReadinessVerification();
const { mutate: signOut } = useSignOutMutation();
const { logAuthEvent } = useSentryLogging();

const handleSignOut = () => {
  signOut();
};

const isClassLinkProvider = computed(() => ssoProvider.value === AUTH_SSO_PROVIDERS.CLASSLINK);
const isCleverProvider = computed(() => ssoProvider.value === AUTH_SSO_PROVIDERS.CLEVER);

onMounted(() => {
  logAuthEvent(AUTH_LOG_MESSAGES.POLLING_ACCOUNT_READINESS, {
    data: { ssoProvider: ssoProvider.value },
  });
  ssoProvider.value = null;
  startPolling();
});
</script>
