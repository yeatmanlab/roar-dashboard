<template>
  <div class="fixed p-4 bg-gray-400" style="bottom: 2rem; left: 2rem">
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
        {{ i18n.t('homeSelector.inactivityLogout', { timeLeft: signOutTimer }) }}
      </template>
    </PvConfirmDialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useIdle, useTimestamp } from '@vueuse/core';
import { useConfirm } from 'primevue/useconfirm';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/store/auth';

// Constants
// @TODO: Move these to a configuration file
const SESSION_TIMEOUT_STORAGE_KEY = 'sessionTimeoutData';
const SESSION_TIMEOUT_LIMIT = 5 * 1000;
const SESSION_TIMEOUT_SIGNOUT_COUNTDOWN = 600;
const SIGNOUT_THRESHOLD = SESSION_TIMEOUT_LIMIT + SESSION_TIMEOUT_SIGNOUT_COUNTDOWN * 1000;

const signOutTimer = ref(SESSION_TIMEOUT_SIGNOUT_COUNTDOWN);
const isSignOutTimerActive = ref(false);
const isDialogVisible = ref(false);

const { idle, lastActive } = useIdle(SESSION_TIMEOUT_LIMIT, { listenForVisibilityChange: false });
const confirm = useConfirm();
const router = useRouter();
const authStore = useAuthStore();
const i18n = useI18n();
const now = useTimestamp({ interval: 1000 });

let countdownTimer = null;

/**
 * Open the confirmation dialog.
 *
 * If the dialog is not already visible, opens the confirmation dialog and starts the countdown timer. Upon accepting
 * the dialog, the countdown timer and the last active timestamp are reset.
 *
 * @returns {void}
 */
const openDialog = () => {
  if (!isDialogVisible.value) {
    confirm.require({
      group: 'inactivity-logout',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: i18n.t('homeSelector.inactivityLogoutAcceptLabel'),
      acceptIcon: 'pi pi-check mr-2',
      blockScroll: true,
      onShow: () => {
        isDialogVisible.value = true;
        startCountdown();
      },
      onHide: () => {
        isDialogVisible.value = false;
      },
      accept: () => {
        resetCountdown();
        lastActive.value = now.value;
        isDialogVisible.value = false;
      },
    });
  }
};

/**
 * Close the confirmation dialog.
 *
 * @returns {void}
 */
const closeDialog = () => {
  isDialogVisible.value = false;
  confirm.close();
};

/**
 * Sign out the user after a period of inactivity.
 * @returns {Promise<void>}
 */
const signOutAfterInactivity = async () => {
  closeDialog();
  await authStore.signOut();
  router.push({ path: '/' });
};

/**
 * Handle the document visibility change event.
 *
 * When users switch tabs or minimize the window, the document visibility change event is triggered. We use this event
 * as browsers tend to both throttle and/or pause JavaScript execution when the tab is not in focus. This event allows
 * us to store the last active timestamp and the current timestamp in localStorage, in order to determine the true idle
 * time when the user returns to the tab.
 *
 * Whilst the useIdle composable technically handles this, it does not work as expected as when the user returns to the
 * tab, the idle timer is immediately reset, making it impossible to determine the true idle time. That's why we
 * initialise useIdle with the option listenForVisibilityChange set to false and handle the visibility change event
 * manually in this function.
 *
 * @returns {void}
 */
const handleVisibilityChange = () => {
  if (document.hidden) {
    // When the user leave the tab, store the last active time and current timestamp in localStorage.
    const data = {
      lastActive: lastActive.value,
      timestamp: Date.now(),
      signOutTimer: signOutTimer.value,
    };

    localStorage.setItem(SESSION_TIMEOUT_STORAGE_KEY, JSON.stringify(data));

    resetCountdown();
  } else {
    // When the user returns, retrieve the data from localStorage.
    const storedDataStr = localStorage.getItem(SESSION_TIMEOUT_STORAGE_KEY);
    const storedData = storedDataStr ? JSON.parse(storedDataStr) : null;

    if (storedData) {
      const { lastActive: storedLastActive, timestamp: storedTimestamp, signOutTimer: storedSignOutTimer } = storedData;
      const elapsedTime = Date.now() - storedLastActive;

      // If the user was away for longer than the threshold for signing out, sign them out immediately.
      if (elapsedTime >= SIGNOUT_THRESHOLD) {
        signOutAfterInactivity();
        return;
      }

      // If the user was away for longer than the session timeout limit but less than the threshold for signing out,
      // determine the remaining time left for the countdown, start it and open the confirmation dialog.
      if (elapsedTime >= SESSION_TIMEOUT_LIMIT) {
        const remainingTimerValue = SESSION_TIMEOUT_SIGNOUT_COUNTDOWN * 1000 - (elapsedTime - SESSION_TIMEOUT_LIMIT);
        signOutTimer.value = Math.floor(remainingTimerValue / 1000);

        openDialog();
        startCountdown();
        return;
      }

      // If the user was away for less than the session timeout limit, set the idle state and last active timestamp
      // accordingly to resume the idle timer based on the actual idle time.
      lastActive.value = storedLastActive;
      idle.value = false;
    }
  }
};

/**
 * Start the sign-out countdown timer.
 *
 * Once the timeout sign-out dialog is opened, a secondary countdown timer is started to count down the remaining time
 * before the user is signed out. This function is called when the dialog is opened as well as manually when the user
 * returns to the tab after being away for a period of time.
 *
 * @returns {void}
 */
const startCountdown = () => {
  if (isSignOutTimerActive.value) return;

  isSignOutTimerActive.value = true;

  countdownTimer = setInterval(async () => {
    signOutTimer.value -= 1;

    if (signOutTimer.value <= 0) {
      resetCountdown(false);
      await signOutAfterInactivity();
    }
  }, 1000);
};

/**
 * Reset the sign-out countdown timer.
 *
 * @param {Boolean} resetToOriginalValue – Whether to reset the countdown to the original value or not.
 * @returns {void}
 */
const resetCountdown = (resetToOriginalValue = true) => {
  clearInterval(countdownTimer);
  countdownTimer = null;
  isSignOutTimerActive.value = false;
  signOutTimer.value = resetToOriginalValue ? SESSION_TIMEOUT_SIGNOUT_COUNTDOWN : 0;
};

watch(idle, (isIdle) => {
  if (isIdle) {
    openDialog();
  }
});

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  resetCountdown();
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
