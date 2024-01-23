<template>
    <div id="jspsych-target" class="game-target" translate="no" />
    <div v-if="!gameStarted" class="col-full text-center">
      <h1>Preparing your game!</h1>
      <AppSpinner />
    </div>
  </template>
  <script setup>
  import { TaskLauncher } from 'core-tasks'
  import { onMounted, watch, ref, onBeforeUnmount } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import { useQuery } from '@tanstack/vue-query';
  import { useAuthStore } from '@/store/auth';
  import { useGameStore } from '@/store/game';
  import _get from 'lodash/get';
  import { fetchDocById } from '@/helpers/query/utils';
  import { toRaw, computed } from 'vue';
  
  const props = defineProps({
    taskId: { type: String, default: 'core-tasks' },
    taskName: { type: String },
  });

  const route = useRoute();
  const recievedTaskName = computed(() => route.params.taskName);

  console.log(recievedTaskName.value)
  
  const taskId = props.taskId;
  const router = useRouter();
  const gameStarted = ref(false);
  const authStore = useAuthStore();
  const gameStore = useGameStore();
  const { isFirekitInit, roarfirekit } = storeToRefs(authStore);
  
  const initialized = ref(false);
  let unsubscribe;
  const init = () => {
    if (unsubscribe) unsubscribe();
    initialized.value = true;
  };
  
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.restConfig) init();
  });
  
  const { isLoading: isLoadingUserData, data: userData } = useQuery({
    queryKey: ['userData', authStore.uid, 'studentData'],
    queryFn: () => fetchDocById('users', authStore.uid, ['studentData']),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // The following code intercepts the back button and instead forces a refresh.
  // We add { once: true } to prevent an infinite loop.
  window.addEventListener(
    'popstate',
    () => {
      router.go(0);
    },
    { once: true },
  );
  
  onMounted(async () => {
    if (roarfirekit.value.restConfig) init();
    if (isFirekitInit.value && !isLoadingUserData.value) {
      await startTask();
    }
  });
  
  watch([isFirekitInit, isLoadingUserData], async ([newFirekitInitValue, newLoadingUserData]) => {
    if (newFirekitInitValue && !newLoadingUserData) await startTask();
  });
  
  
  const { selectedAdmin } = storeToRefs(gameStore);
  
  const selectBestRun = async () => {
    await authStore.roarfirekit.selectBestRun({
      assignmentId: selectedAdmin.value.id,
      taskId,
    });
  };
  
  window.addEventListener('beforeunload', selectBestRun, { once: true });

  onBeforeUnmount(async () => {
    selectBestRun();
  });
  
  async function startTask() {
    console.log('selectedAdmin.value:', toRaw(selectedAdmin.value))
    console.log('taskId:', taskId)
    const appKit = await authStore.roarfirekit.startAssessment(selectedAdmin.value.id, taskId, recievedTaskName.value);
  
    const userDob = _get(userData.value, 'studentData.dob');
    const userDateObj = new Date(userDob);
  
    const userParams = {
      grade: _get(userData.value, 'studentData.grade'),
      birthMonth: userDateObj.getMonth() + 1,
      birthYear: userDateObj.getFullYear(),
    };
  
    console.log('taskInfo: ', appKit._taskInfo)

    const gameParams = { ...appKit._taskInfo.variantParams, fromDashboard: true };
    console.log({gameParams})
    const levanteTask = new TaskLauncher(appKit, gameParams, userParams, 'jspsych-target');
  
    gameStarted.value = true;
    await levanteTask.run().then(async () => {
      // Handle any post-game actions.
      await authStore.completeAssessment(selectedAdmin.value.id, taskId);
  
      // Navigate to home, but first set the refresh flag to true.
      gameStore.requireHomeRefresh();
      router.push({ name: 'Home' });
    });
  }
  </script>
  <style>
  /* @import '@bdelab/roar-multichoice/lib/resources/roar-multichoice.css'; */
  
  .game-target {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  .game-target:focus {
    outline: none;
  }
  </style>