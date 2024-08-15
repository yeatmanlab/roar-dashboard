<template>
  <PvConfirmDialog
    group="inactivity-logout"
    :pt="{
      root: { class: 'px-5' },
      content: { style: 'max-width: 48rem' },
      closeButton: { class: 'hidden' },
      rejectButton: { root: { class: 'hidden' } },
    }"
  >
    <template #message>
      {{ i18n.t('homeSelector.inactivityLogout', { timeLeft: countdownTimer }) }}
    </template>
  </PvConfirmDialog>
</template>

<script setup>
import { useConfirm } from 'primevue/useconfirm';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useInactivityTimeout } from '@/composables/useInactivityTimeout/useInactivityTimeout';
import { useAuthStore } from '@/store/auth';
import { APP_ROUTES } from '@/constants/routes';
import { AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD, AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION } from '@/constants/auth';

const authStore = useAuthStore();
const confirm = useConfirm();
const router = useRouter();
const i18n = useI18n();

const { countdownTimer, resetTimer } = useInactivityTimeout({
  idleThreshold: AUTH_SESSION_TIMEOUT_IDLE_THRESHOLD,
  countdownDuration: AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION,
  onIdle: () => {
    confirm.require({
      group: 'inactivity-logout',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: i18n.t('homeSelector.inactivityLogoutAcceptLabel'),
      acceptIcon: 'pi pi-check mr-2',
      blockScroll: true,
      accept: resetTimer,
    });
  },
  onTimeout: async () => {
    await authStore.signOut();
    router.push({ path: APP_ROUTES.SIGN_IN });
  },
});
</script>

<style>
button.p-button.p-component.p-confirm-dialog-accept {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem;
}
</style>
