<template>
  <div id="games" class="game-tab-container">
    <PvTabView v-model:activeIndex="displayGameIndex" :scrollable="true" class="flex flex-column">
      <PvTabPanel
        v-for="(game, index) in games"
        :key="game.taskId"
        :disabled="
          sequential &&
          ((index > 0 && !games[index - 1].completedOn) ||
            (allGamesComplete && currentGameId !== game.taskId && !game.completedOn))
        "
      >
        <template #header>
          <!--Complete Game-->
          <i v-if="game.completedOn" class="pi pi-check-circle mr-2" data-game-status="complete" />
          <!--Current Game-->
          <i
            v-else-if="game.taskId == currentGameId || !sequential"
            class="pi pi-circle mr-2"
            data-game-status="current"
          />
          <!--Locked Game-->
          <i v-else-if="sequential" class="pi pi-lock mr-2" data-game-status="incomplete" />
          <span class="tabview-nav-link-label" :data-game-status="`${game.completedOn ? 'complete' : 'incomplete'}`">{{
            getTaskName(game.taskId, game.taskData.name)
          }}</span>
        </template>
        <div class="roar-tabview-game pointer flex flex-column">
          <div class="flex">
            <div class="roar-game-content flex-grow-1 mr-4">
              <div class="roar-game-title">{{ getTaskName(game.taskId, game.taskData.name) }}</div>
              <div class="roar-game-description">
                <p>{{ getTaskDescription(game.taskId, game.taskData.description) }}</p>
              </div>
              <div class="roar-game-meta">
                <PvTag
                  v-for="(items, metaIndex) in game.taskData.meta"
                  :key="metaIndex"
                  :value="metaIndex + ': ' + items"
                />
              </div>
            </div>
            <div class="roar-game-image flex-shrink-0">
              <div v-if="game.taskData?.tutorialVideo" class="video-player-wrapper">
                <VideoPlayer
                  :options="returnVideoOptions(game.taskData?.tutorialVideo)"
                  :on-video-end="updateVideoCompleted"
                  :on-video-start="updateVideoStarted"
                  :task-id="game.taskId"
                />
              </div>
              <div v-else>
                <img v-if="game.taskData.image" :src="game.taskData.image" />
                <img v-else src="https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png" />
              </div>
            </div>
          </div>
          
          <div v-if="game.taskId === 'survey'" class="mt-4 px-4">
            <div class="flex align-items-center mb-2">
              <span class="mr-2 w-4"><b>{{ $t('gameTabs.surveyProgressGeneral') }} </b> - {{ 
                props.userData.userType === 'teacher' || props.userData.userType === 'parent' ? 
                props.userData.userType === 'teacher' ? $t('gameTabs.surveyProgressGeneralTeacher') : $t('gameTabs.surveyProgressGeneralParent') : '' }}
              </span>
              <PvProgressBar 
                :value="getGeneralSurveyProgress" 
                class="flex-grow-1" 
              />
            </div>

            <div v-if="props.userData.userType === 'parent'">
              <div v-for="(child, i) in props.userData?.childIds" :key="child" class="flex flex-wrap align-items-center mb-2">
                <span class="mr-2 w-full sm:w-4 mb-1 sm:mb-0">
                  <b>{{ $t('gameTabs.surveyProgressSpecificParent') }} - </b> {{ $t('gameTabs.surveyProgressSpecificParentMonth') }}: {{ surveyStore.specificSurveyRelationData[i]?.birthMonth }} 
                  <br class="sm:hidden" />
                  {{ $t('gameTabs.surveyProgressSpecificParentYear') }}: {{ surveyStore.specificSurveyRelationData[i]?.birthYear }}
                </span>
                <PvProgressBar 
                  :value="getSpecificSurveyProgress(i)" 
                  class="flex-grow-1 w-full sm:w-auto incomplete-progress-bar"
                />
              </div>
            </div>

            <div v-if="props.userData.userType === 'teacher'">
              <div v-for="(classroom, i) in props.userData?.classes?.current" :key="classroom" class="flex flex-wrap align-items-center mb-2">
                <span class="mr-2 w-full sm:w-4 mb-1 sm:mb-0">
                  <b>Classroom - </b> {{ surveyStore.specificSurveyRelationData[i]?.name }}
                </span>
                <PvProgressBar 
                  :value="getSpecificSurveyProgress(i)" 
                  class="flex-grow-1 w-full sm:w-auto"
                />
              </div>
            </div>
          </div>

          <div class="roar-game-footer mt-4" @click="routeExternalTask(game)">
            <i v-if="!allGamesComplete" class="pi">
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="42" height="42" rx="21" fill="#A80532" />
                <path
                  d="M26.1858 19.6739L17.4823 14.1736C16.7751 13.7269 15.6921 14.1604 15.6921 15.2652V26.2632C15.6921 27.2544 16.6985 27.8518 17.4823 27.3549L26.1858 21.8572C26.9622 21.3682 26.9647 20.1629 26.1858 19.6739Z"
                  fill="white"
                />
              </svg>
            </i>
            <span v-if="!allGamesComplete && !game.completedOn">{{ $t('gameTabs.clickToStart') }}</span>
            <span v-else>{{ taskCompletedMessage }}</span>
            <router-link
              v-if="!allGamesComplete && !game.completedOn && !game.taskData?.taskURL && !game.taskData?.variantURL"
              :to="{ path: getRoutePath(game.taskId) }"
            ></router-link>
          </div>
        </div>
      </PvTabPanel>
    </PvTabView>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import _get from 'lodash/get';
import _find from 'lodash/find';
import _findIndex from 'lodash/findIndex';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { useSurveyStore } from '@/store/survey';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { camelize, getAgeData } from '@bdelab/roar-utils';
import VideoPlayer from '@/components/VideoPlayer.vue';
import { isLevante } from '@/helpers';
import _capitalize from 'lodash/capitalize';
import { useQueryClient } from '@tanstack/vue-query';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';

const props = defineProps({
  games: { type: Array, required: true },
  sequential: { type: Boolean, required: false, default: true },
  userData: { type: Object, required: true },
});

const authStore = useAuthStore();
const gameStore = useGameStore();
const surveyStore = useSurveyStore();
const queryClient = useQueryClient();
const surveyData = queryClient.getQueryData(['surveyResponses', props.userData.id]);

const getGeneralSurveyProgress = computed(() => {
  if (surveyStore.isGeneralSurveyComplete) return 100;
  if (!surveyStore.survey) return 0;
  return Math.round(((surveyStore.survey.currentPageNo - 1) / (surveyStore.numGeneralPages - 1)) * 100);
});

const getSpecificSurveyProgress = computed(() => (loopIndex) => {
  const localStorageKey = `${LEVANTE_SURVEY_RESPONSES_KEY}-${props.userData.id}`;
  const localStorageData = JSON.parse(localStorage.getItem(localStorageKey) || '{}');

  if (localStorageData && surveyStore.specificSurveyRelationData[loopIndex]) {
    const specificIdFromServer = surveyStore.specificSurveyRelationData[loopIndex].id;

    if (specificIdFromServer === localStorageData.specificId) {

        if (localStorageData.isComplete) return 100;

        const currentPage = localStorageData.pageNo || 0;
        const totalPages = surveyStore.numSpecificPages || 1;

        return Math.round((currentPage / totalPages) * 100);
    }
  }

  // If data not found in localStorage, use surveyData from server
  if (!surveyData || !Array.isArray(surveyData)) return 0;

  const currentSurvey = surveyData.find(doc => doc.administrationId === selectedAdmin.value.id);
  if (!currentSurvey || !currentSurvey.specific || !currentSurvey.specific[loopIndex]) return 0;
  
  const specificSurvey = currentSurvey.specific[loopIndex];
  if (specificSurvey.isComplete) return 100;

  const currentPage = currentSurvey.pageNo || 0;
  const totalPages = surveyStore.numSpecificPages || 1;

  return Math.round((currentPage / totalPages) * 100);
});

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

  if (taskIdLowercased === 'survey') {
    if (props.userData.userType === 'teacher' || props.userData.userType === 'parent') {
      return t(`gameTabs.surveyName${_capitalize(props.userData.userType)}Part1`);
    } else {
      // child
      return t(`gameTabs.surveyNameChild`);
    }
  }

  if (levanteTasks.includes(camelize(taskIdLowercased))) {
    return t(`gameTabs.${camelize(taskIdLowercased)}Name`); 
  }
  return taskName;
};
const getTaskDescription = (taskId, taskDescription) => {
  // Translate Levante task descriptions if not in English
  const taskIdLowercased = taskId.toLowerCase();

  if (taskIdLowercased === 'survey') {
    if (props.userData.userType === 'teacher' || props.userData.userType === 'parent') {
      return t(`gameTabs.surveyDescription${_capitalize(props.userData.userType)}Part1`);
    } else {
      // child
      return t(`gameTabs.surveyDescriptionChild`);
    }
  }

  if (levanteTasks.includes(camelize(taskIdLowercased))) {
    return t(`gameTabs.${camelize(taskIdLowercased)}Description`);
  }
  return taskDescription;
};

const getRoutePath = (taskId) => {
  const lowerCasedAndCamelizedTaskId = camelize(taskId.toLowerCase());

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

const displayGameIndex = computed(() => (gameIndex.value === -1 ? 0 : gameIndex.value));
const allGamesComplete = computed(() => gameIndex.value === -1);

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

  if (game.taskData.name.toLowerCase() === 'mefs') {
    const ageInMonths = getAgeData(props.userData.birthMonth, props.userData.birthYear).ageMonths;
    url += `participantID=${props.userData.id}&participantAgeInMonths=${ageInMonths}&lng=${locale.value}`;
    window.open(url, '_blank').focus();
    await authStore.completeAssessment(selectedAdmin.value.id, game.taskId);
  } else {
    url += `&participant=${props.userData.assessmentPid}${
      props.userData.schools.length ? '&schoolId=' + props.userData.schools.current.join('“%2C”') : ''
    }${props.userData.classes.current.length ? '&classId=' + props.userData.classes.current.join('“%2C”') : ''}`;

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
@media screen and (max-width: 768px) {
  .video-player-wrapper {
    min-width: 250px;
  }
}

.roar-tabview-game {
  display: flex;
  flex-direction: column;
}

.roar-tabview-game > .flex {
  display: flex;
  flex-direction: row;
}

.roar-game-image {
  width: 350px;
  flex-shrink: 0;
}

.roar-game-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  margin-right: 1rem; // Add this line
}

.roar-game-footer {
  margin-top: 1rem;
  width: 100%;
  text-align: center;
  background-color: #f0f0f0;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}

@media screen and (max-width: 768px) {
  .roar-tabview-game > .flex {
    flex-direction: column;
  }

  .roar-game-image {
    width: 100%;
    margin-top: 1rem; // Add this line
  }

  .roar-game-content {
    margin-right: 0; // Add this line
  }
}

</style>
