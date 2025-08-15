<template>
  <div v-if="!appKit || !userParams || !gameParams" class="text-center col-full">
    <h1>{{ $t('tasks.preparing') }}</h1>
    <AppSpinner />
  </div>
  <SurveyRunner
    v-else
    :appkit="appKit"
    :user-params="userParams"
    :game-params="gameParams"
    @complete-survey="handleCompleteSurvey"
  />
</template>
<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import packageLockJson from '../../../../../package-lock.json';
import SurveyRunner from '@bdelab/roar-survey';

const props = defineProps({
  taskId: { type: String, required: true, default: 'swr' },
  language: { type: String, required: true, default: 'en' },
  launchId: { type: String, required: false, default: null },
});

const userParams = ref(null);
const gameParams = ref(null);

const taskId = props.taskId;
const version = packageLockJson.packages['node_modules/@bdelab/roar-survey'].version;
const router = useRouter();
const taskStarted = ref(false);
const authStore = useAuthStore();
const gameStore = useGameStore();
const { isFirekitInit, roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);
let unsubscribe;
const appKit = ref(null);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};
const handlePopState = () => {
  router.go(0);
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) init();
});

const { isLoading: isLoadingUserData, data: userData } = useUserStudentDataQuery(props.launchId, {
  enabled: initialized,
});

// The following code intercepts the back button and instead forces a refresh.
// We add { once: true } to prevent an infinite loop.
window.addEventListener(
  'popstate',
  () => {
    handlePopState();
  },
  { once: true },
);

onMounted(async () => {
  if (roarfirekit.value.restConfig?.()) init();
});

// Declare interval at component scope
let checkGameStarted;

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
  if (checkGameStarted) clearInterval(checkGameStarted);
});

watch(
  [isFirekitInit, isLoadingUserData],
  async ([newFirekitInitValue, newLoadingUserData]) => {
    if (newFirekitInitValue && !newLoadingUserData && !taskStarted.value) {
      taskStarted.value = true;
      const { selectedAdmin } = storeToRefs(gameStore);
      await startTask(selectedAdmin);
    }
  },
  { immediate: true },
);

async function startTask(selectedAdmin) {
  try {
    appKit.value = await authStore.roarfirekit.startAssessment(selectedAdmin.value.id, taskId, version, props.launchId);

    const userDob = _get(userData.value, 'studentData.dob');
    const userDateObj = new Date(userDob);

    userParams.value = {
      grade: _get(userData.value, 'studentData.grade'),
      birthMonth: userDateObj.getMonth() + 1,
      birthYear: userDateObj.getFullYear(),
      language: props.language,
    };

    gameParams.value = { ...appKit.value._taskInfo.variantParams };
  } catch (error) {
    console.error('An error occurred while starting the task:', error);
    alert(
      'An error occurred while starting the task. Please refresh the page and try again. If the error persists, please submit an issue report.',
    );
  }
}

async function handleCompleteSurvey() {
  try {
    const { selectedAdmin } = storeToRefs(gameStore);
    await authStore.completeAssessment(selectedAdmin.value.id, taskId, props.launchId);
    gameStore.requireHomeRefresh();
    // if session is externally launched, return instead fo participant home
    if (props.launchId) {
      router.push({ name: 'LaunchParticipant', params: { launchId: props.launchId } });
    }
    // Navigate to home, but first set the refresh flag to true.
    else {
      router.push({ name: 'Home' });
    }
  } catch (error) {
    console.error('An error occurred while completing the survey:', error);
    alert(
      'An error occurred while completing the survey. Please refresh the page and try again. If the error persists, please submit an issue report.',
    );
  }
}
</script>

<style>
@import '@bdelab/roar-survey/lib/roar-survey.css';
.sd-root-modern__wrapper {
  margin: auto;
}
</style>
