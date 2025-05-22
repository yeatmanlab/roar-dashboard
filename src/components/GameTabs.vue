<template>
  <div id="games">
    <PvTabs v-model:value="displayGameIndex" scrollable>
      <PvTabList>
        <PvTab
          v-for="(game, index) in games"
          :key="game.taskId"
          :disabled="
            sequential &&
            ((index > 0 && !games[index - 1].completedOn) ||
              (allGamesComplete && currentGameId !== game.taskId && !game.completedOn && !game?.unsuitableForScoring))
          "
          :value="String(index)"
          :class="[
            'p3 mr-1 text-base hover:bg-black-alpha-10',
            {
              'text-yellow-600': game?.unsuitableForScoring === true,
              'text-green-500': game.completedOn && game?.unsuitableForScoring !== true,
              'bg-white': game.completedOn && game?.unsuitableForScoring !== true,
            },
          ]"
          style="border: solid 2px #00000014; border-radius: 10px"
        >
          <span class="flex align-items-center gap-2">
            {{ getTaskName(game.taskId, game.taskData.name) }}
          </span>
        </PvTab>
      </PvTabList>
      <PvTabPanels style="width: 120vh">
        <PvTabPanel
          v-for="(game, index) in games"
          :key="game.taskId"
          :disabled="
            sequential &&
            ((index > 0 && !games[index - 1].completedOn) ||
              (allGamesComplete && currentGameId !== game.taskId && !game.completedOn && !game?.unsuitableForScoring))
          "
          :value="String(index)"
          class="p-0"
        >
          <template #header>
            <!--Unsuitable for Scoring-->
            <i
              v-if="game?.unsuitableForScoring === true"
              class="pi pi-exclamation-circle mr-2"
              data-game-status="unsuitable"
            />
            <!--Complete Game-->
            <i v-else-if="game.completedOn" class="pi pi-check-circle mr-2" data-game-status="complete" />
            <!--Current Game-->
            <i
              v-else-if="game.taskId == currentGameId || !sequential"
              class="pi pi-circle mr-2"
              data-game-status="current"
            />
            <!--Locked Game-->
            <i v-else-if="sequential" class="pi pi-lock mr-2" data-game-status="incomplete" />
            <span
              class="tabview-nav-link-label"
              :data-game-status="`${game.completedOn ? 'complete' : 'incomplete'}`"
              >{{ getTaskName(game.taskId, game.taskData.name) }}</span
            >
          </template>
          <div class="roar-tabview-game flex flex-row p-5 surface-100 w-full">
            <div class="roar-game-content flex flex-column" style="width: 70%" @click="routeExternalTask(game)">
              <div class="roar-game-title font-bold">{{ getTaskName(game.taskId, game.taskData.name) }}</div>
              <div class="roar-game-description mr-2">
                <p>{{ getTaskDescription(game.taskId, game.taskData.description) }}</p>
              </div>
              <div class="flex flex-column h-full">
                <div class="roar-game-meta">
                  <PvTag
                    v-for="(items, metaIndex) in game.taskData.meta"
                    :key="metaIndex"
                    :value="metaIndex + ': ' + items"
                  />
                </div>
                <div
                  class="roar-game-footer p-3 h-full mr-5"
                  :class="{ 'hover:surface-200 pointer': !game.completedOn || game.taskData.external }"
                >
                  <div class="flex align-items-center justify-content-center font-bold mt-2 h-full responsive-text">
                    <router-link
                      v-if="
                        (!allGamesComplete &&
                          !game.completedOn &&
                          !game.taskData?.taskURL &&
                          !game.taskData?.variantURL) ||
                        game.taskData.external
                      "
                      :to="game.taskData.external ? '' : { path: getRoutePath(game.taskId) }"
                      class="no-underline text-900 text-center"
                    >
                      <div class="flex align-items-center justify-content-center h-full w-full">
                        <i v-if="!allGamesComplete" class="pi"
                          ><svg
                            viewBox="0 0 42 42"
                            fill="none"
                            class="responsive-icon"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect width="42" height="42" rx="21" fill="#A80532" />
                            <path
                              d="M26.1858 19.6739L17.4823 14.1736C16.7751 13.7269 15.6921 14.1604 15.6921 15.2652V26.2632C15.6921 27.2544 16.6985 27.8518 17.4823 27.3549L26.1858 21.8572C26.9622 21.3682 26.9647 20.1629 26.1858 19.6739Z"
                              fill="white"
                            />
                          </svg>
                        </i>
                      </div>
                      <span v-if="game.taskData.external && game.completedOn">{{
                        $t('gameTabs.externalTaskMessage')
                      }}</span>
                      <span
                        v-else-if="
                          (!allGamesComplete && !game.completedOn) || (game.taskData.external && !game.completedOn)
                        "
                        >{{ $t('gameTabs.clickToStart') }}</span
                      >
                      <span v-else style="cursor: default">{{ taskCompletedMessage }}</span>
                    </router-link>
                    <div v-else>
                      <div
                        :class="{
                          // 'text-yellow-600': game.unsuitableForScoring === true,
                          // 'text-green-500': game.completedOn
                        }"
                        class="flex align-items-center justify-content-center"
                      >
                        <i
                          v-if="game.completedOn && game.unsuitableForScoring !== true"
                          class="pi pi-check-circle mr-3"
                        />
                        <div class="flex flex-column align-items-center gap-2">
                          <span v-if="game.unsuitableForScoring !== true" style="cursor: default">{{
                            taskCompletedMessage
                          }}</span>
                          <PvMessage v-if="game?.unsuitableForScoring === true" severity="warn" class="w-full">
                            <div class="flex flex-column align-items-center gap-2">
                              <span>{{ $t('gameTabs.unsuitableForScoring') }}</span>
                              <router-link
                                :to="game.taskData.external ? '' : { path: getRoutePath(game.taskId) }"
                                class="no-underline text-yellow-900 hover:text-yellow-800 w-full flex align-items-center justify-content-center p-3 hover:bg-yellow-100"
                                @click="game.taskData.external && routeExternalTask(game)"
                              >
                                <i class="pi pi-refresh mr-2"></i>{{ $t('gameTabs.retakeAssessment') }}
                              </router-link>
                            </div>
                          </PvMessage>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="roar-game-image">
              <div
                v-if="game.taskData?.tutorialVideo && userData?.studentData?.grade <= 3"
                class="video-player-wrapper"
              >
                <VideoPlayer
                  :options="returnVideoOptions(game.taskData?.tutorialVideo)"
                  :on-video-end="updateVideoCompleted"
                  :on-video-start="updateVideoStarted"
                  :task-id="game.taskId"
                  style="width: 28vw"
                />
              </div>
              <div v-else>
                <img v-if="game.taskData.image" :src="game.taskData.image" style="width: 28vw" />
                <!-- TODO: Get real backup image -->
                <img
                  v-else
                  src="https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png"
                  style="width: 28vw"
                />
              </div>
            </div>
          </div>
        </PvTabPanel>
      </PvTabPanels>
    </PvTabs>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import _find from 'lodash/find';
import _findIndex from 'lodash/findIndex';
import { camelize, getAgeData } from '@bdelab/roar-utils';
import PvTabPanel from 'primevue/tabpanel';
import PvTabs from 'primevue/tabs';
import PvTabList from 'primevue/tablist';
import PvTab from 'primevue/tab';
import PvTabPanels from 'primevue/tabpanels';
import PvTag from 'primevue/tag';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import VideoPlayer from '@/components/VideoPlayer.vue';
import PvMessage from 'primevue/message';

const props = defineProps({
  games: { type: Array, required: true },
  sequential: { type: Boolean, required: false, default: true },
  userData: { type: Object, required: true },
  launchId: { type: String, required: false, default: null },
});
const isLevante = import.meta.env.MODE === 'LEVANTE';

const { t, locale } = useI18n();

const levanteTasks = [
  'heartsAndFlowers',
  'egmaMath',
  'matrixReasoning',
  'memoryGame',
  'mentalRotation',
  'sameDifferentSelection',
  'theoryOfMind',
  'trog',
  'survey',
  'mefs',
  'roarInference',
];

const levantifiedRoarTasks = [
  'vocab',
  // Not yet implemented
  // 'swr',
  // 'swr-es',
  // 'sre',
  // 'sre-es',
  // 'pa',
  // 'pa-es',
];

const getTaskName = (taskId, taskName) => {
  // Translate Levante task names. The task name is not the same as the taskId.
  const taskIdLowercased = taskId.toLowerCase();

  if (levanteTasks.includes(camelize(taskIdLowercased))) {
    return t(`gameTabs.${camelize(taskIdLowercased)}Name`);
  }
  return taskName;
};
const getTaskDescription = (taskId, taskDescription) => {
  // Translate Levante task descriptions if not in English
  const taskIdLowercased = taskId.toLowerCase();

  if (levanteTasks.includes(camelize(taskIdLowercased))) {
    return t(`gameTabs.${camelize(taskIdLowercased)}Description`);
  }
  return taskDescription;
};

const getRoutePath = (taskId) => {
  const lowerCasedAndCamelizedTaskId = camelize(taskId.toLowerCase());
  // For externally launched participants, prepend the launch route to the task path
  if (props.launchId) {
    if (lowerCasedAndCamelizedTaskId === 'survey') {
      return `/launch/${props.launchId}/survey`;
    } else if (
      levanteTasks.includes(lowerCasedAndCamelizedTaskId) ||
      (isLevante && levantifiedRoarTasks.includes(lowerCasedAndCamelizedTaskId))
    ) {
      return `/launch/${props.launchId}/game/core-tasks/` + taskId;
    } else {
      return `/launch/${props.launchId}/game/` + taskId;
    }
  } else {
    if (lowerCasedAndCamelizedTaskId === 'survey') {
      return '/survey';
    } else if (
      levanteTasks.includes(lowerCasedAndCamelizedTaskId) ||
      (isLevante && levantifiedRoarTasks.includes(lowerCasedAndCamelizedTaskId))
    ) {
      return '/game/core-tasks/' + taskId;
    } else {
      return '/game/' + taskId;
    }
  }
};

const taskCompletedMessage = computed(() => {
  return t('gameTabs.taskCompleted');
});

const updateVideoStarted = async (taskId) => {
  try {
    await authStore.roarfirekit.updateVideoMetadata(selectedAdmin.value.id, taskId, 'started');
  } catch (e) {
    console.error('Error while updating video completion', e);
  }
};

const updateVideoCompleted = async (taskId) => {
  try {
    await authStore.roarfirekit.updateVideoMetadata(selectedAdmin.value.id, taskId, 'completed');
  } catch (e) {
    console.error('Error while updating video completion', e);
  }
};

const currentGameId = computed(() => {
  return _get(
    _find(props.games, (game) => {
      return game.completedOn === undefined;
    }),
    'taskId',
  );
});

const gameIndex = computed(() =>
  _findIndex(props.games, (game) => {
    return game.taskId === currentGameId.value;
  }),
);

// We need to set display index to String as it is required by primevue to set the tabs
const displayGameIndex = computed(() => String(gameIndex.value === -1 ? 0 : gameIndex.value));
const allGamesComplete = computed(() => gameIndex.value === -1);

const authStore = useAuthStore();
const gameStore = useGameStore();

const { selectedAdmin } = storeToRefs(gameStore);

async function routeExternalTask(game) {
  let url;

  if (!allGamesComplete.value && game.taskData?.variantURL) {
    url = game.taskData.variantURL;
  } else if (!allGamesComplete.value && game.taskData?.taskURL) {
    url = game.taskData.taskURL;
  } else {
    return;
  }

  // Mark the assessment as complete immediately if external roar task and clicked the button
  if (game.taskData.external) {
    await authStore.completeAssessment(selectedAdmin.value.id, game.taskId);

    let taskUrl = game.taskData.taskURL;
    if (game.taskId.includes('qualtrics')) {
      // this was a request for a qualtrics-based task
      taskUrl += `/?participantID=${props?.userData?.assessmentPid}`;
    }

    window.open(taskUrl, '_blank')?.focus();
  } else if (game.taskData.name.toLowerCase() === 'mefs') {
    // this is a levante external task
    const ageInMonths = getAgeData(props.userData.birthMonth, props.userData.birthYear).ageMonths;
    url += `participantID=${props.userData.id}&participantAgeInMonths=${ageInMonths}&lng=${locale.value}`;
    window.open(url, '_blank').focus();
    await authStore.completeAssessment(selectedAdmin.value.id, game.taskId);
  } else {
    // This is for no external tasks
    url += `&participant=${props.userData.assessmentPid}${
      (props?.userData?.schools?.current ?? []).length
        ? '&schoolId=' + props.userData.schools.current.join('“%2C”')
        : ''
    }${
      (props.userData?.classes?.current ?? []).length ? '&classId=' + props.userData.classes.current.join('“%2C”') : ''
    }`;

    await authStore.completeAssessment(selectedAdmin.value.id, game.taskId);
    window.location.href = url;
  }
}

const returnVideoOptions = (videoURL) => {
  return {
    autoplay: false,
    controls: true,
    preload: true,
    fluid: true,
    sources: [
      {
        src: videoURL,
        type: 'video/mp4',
      },
    ],
  };
};
</script>

<style scoped lang="scss">
.game-tab-container {
  max-width: 75vw;
}

.pointer {
  cursor: pointer;
}

.video-player-wrapper {
  min-width: 350px;
  align-items: center;
  min-height: 100%;
}

.p-tab-active {
  background: var(--surface-100);
  border-color: var(--p-tabs-tab-active-border-color) !important;
  color: var(--p-tabs-tab-active-color);
}

.responsive-icon {
  width: 4vw;
  height: auto;
}
.responsive-text {
  font-size: 1.5vw;
}

@media (min-width: 1200px) {
  .responsive-icon {
    width: 6vw;
  }
}
@media screen and (max-width: 768px) {
  .video-player-wrapper {
    min-width: 250px;
  }
  .responsive-text {
    font-size: 2vw;
  }
}
</style>
