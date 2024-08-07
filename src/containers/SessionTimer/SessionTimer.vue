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

import { SESSION_STORAGE_SESSION_TIMEOUT_KEY } from '@/constants/sessionStorage';
import {
  AUTH_SESSION_TIMEOUT_LIMIT,
  AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION,
  AUTH_SESSION_SIGNOUT_THRESHOLD,
} from '@/constants/auth';

const signOutTimer = ref(Math.floor(AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION / 1000));
const isSignOutTimerActive = ref(false);
const isDialogVisible = ref(false);

const authStore = useAuthStore();
const confirm = useConfirm();
const router = useRouter();
const i18n = useI18n();

// Use the useIdle composable to determine the idle state of the user.
// Important: listenForVisibilityChange is set to false to handle the visibility change event manually. This is
// necessary as useIdle resets the idle timer when the user returns to the tab, making it impossible to determine the
// true idle time when the user returns. We handle the visibility change event manually in the handleVisibilityChange
// function, allowing us to store and evaluate the true idle time.
const { idle, lastActive } = useIdle(AUTH_SESSION_TIMEOUT_LIMIT, { listenForVisibilityChange: false });
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
 * Set the session storage.
 *
 * Store the last active timestamp in sessionStorage to persist the last active timestamp when the user switches tabs.
 * Important: we use sessionStorage as the application uses this type of storage to persist auth state as one of the
 * requirements is to keep tabs as separate sessions.
 *
 * @returns {void}
 */
const updateSessionStorage = () => {
  const data = { lastActive: lastActive.value };
  sessionStorage.setItem(SESSION_STORAGE_SESSION_TIMEOUT_KEY, JSON.stringify(data));
};

/**
 * Reset the session storage.
 *
 * Ensure we reset the session when the component is unmounted in order to prevent the having an outdated lastActive
 * value when the user returns to the site after being away for a period of time.
 *
 * @returns {void}
 */
const resetSessionStorage = () => {
  sessionStorage.removeItem(SESSION_STORAGE_SESSION_TIMEOUT_KEY);
};

/**
 * Handle the document visibility change event.
 *
 * When users switch tabs or minimize the window, the document visibility change event is triggered. We use this event
 * as browsers tend to both throttle and/or pause JavaScript execution when the tab is not in focus. This event allows
 * us to store the last active timestamp and the current timestamp in sessionStroage, in order to determine the true
 * idle time when the user returns to the tab.
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
    // When the user leave the tab, store the lastActive time and reset the countdown.
    // Important: if the countdown dialog is visible, skip storing the lastActive time to prevent the countdown being
    // reset as we want to keep the countdown running when the user returns to the tab after being away.
    if (!isDialogVisible.value) {
      updateSessionStorage();
    }

    resetCountdown();
  } else {
    // When the user returns, retrieve the data from sessionStorage.
    const storedDataStr = sessionStorage.getItem(SESSION_STORAGE_SESSION_TIMEOUT_KEY);
    const storedData = storedDataStr ? JSON.parse(storedDataStr) : null;

    // If there is no stored data, abort as there is nothing to do.
    if (!storedData) return;

    const { lastActive: storedLastActive } = storedData;
    const elapsedTime = Date.now() - storedLastActive;

    // If the user was away for longer than the threshold for signing out, sign them out immediately.
    if (elapsedTime >= AUTH_SESSION_SIGNOUT_THRESHOLD) {
      signOutAfterInactivity();
      return;
    }

    // If the user was away for longer than the session timeout limit but less than the threshold for signing out,
    // determine the remaining time left for the countdown, start it and open the confirmation dialog.
    if (elapsedTime >= AUTH_SESSION_TIMEOUT_LIMIT) {
      const remainingTimerValue =
        AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION * 1000 - (elapsedTime - AUTH_SESSION_TIMEOUT_LIMIT);
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
  signOutTimer.value = resetToOriginalValue ? Math.floor(AUTH_SESSION_TIMEOUT_COUNTDOWN_DURATION / 1000) : 0;
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
  resetSessionStorage();
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
