<template>
  <div id="games">
    <PvTabs v-model:active-index="displayGameIndex" scrollable value="0">
      <PvTabList>
        <PvTab
          v-for="(game, index) in games"
          :key="game.taskId"
          :disabled="
            sequential &&
            ((index > 0 && !games[index - 1].completedOn) ||
              (allGamesComplete && currentGameId !== game.taskId && !game.completedOn))
          "
          :value="String(index)"
          :class="[
            'p3 mr-1 text-base hover:bg-black-alpha-10',
            { 'text-green-500': isTaskComplete(game.completedOn, game.taskId) },
          ]"
          style="border: solid 2px #00000014 !important; border-radius: 10px"
        >
          <!--Complete Game-->
          <i
            v-if="isTaskComplete(game.completedOn, game.taskId)"
            class="pi pi-check-circle mr-2"
            data-game-status="complete"
          />
          <!--Current Game-->
          <i
            v-else-if="game.taskId == currentGameId || !sequential"
            class="pi pi-circle mr-2"
            data-game-status="current"
          />
          <!--Locked Game-->
          <i v-if="sequential" class="pi pi-lock mr-2" data-game-status="incomplete" />
          <span
            class="tabview-nav-link-label"
            :data-game-status="`${isTaskComplete(game.completedOn, game.taskId) ? 'complete' : 'incomplete'}`"
            >{{ getTaskName(game.taskId, game.taskData.name) }}</span
          >
        </PvTab>
      </PvTabList>
      <PvTabPanels style="width: 80vw; min-width: 800px; max-width: 1200px; margin-top: 0.5rem; padding: 0">
        <PvTabPanel
          v-for="(game, index) in games"
          :key="game.taskId"
          :disabled="
            sequential &&
            ((index > 0 && !games[index - 1].completedOn) ||
              (allGamesComplete && currentGameId !== game.taskId && !game.completedOn))
          "
          :value="String(index)"
          class="p-0"
        >
          <div class="roar-tabview-game flex flex-row p-5 surface-100 w-full">
            <div class="roar-game-content flex flex-column" style="width: 65%">
              <div class="flex flex-column h-full">
                <div class="roar-game-title font-bold">
                  {{ getTaskName(game.taskId, game.taskData.name) }}
                </div>
                <div class="roar-game-description mr-2 flex-grow-1">
                  <p>
                    {{ getTaskDescription(game.taskId, game.taskData.description) }}
                  </p>
                </div>

                <div v-if="game.taskId === 'survey'" class="mt-4 mb-4">
                  <div class="flex align-items-center mb-2">
                    <span class="mr-2 w-4"
                      ><b>{{ $t('gameTabs.surveyProgressGeneral') }} </b> -
                      {{
                        props.userData.userType === 'teacher' || props.userData.userType === 'parent'
                          ? props.userData.userType === 'teacher'
                            ? $t('gameTabs.surveyProgressGeneralTeacher')
                            : $t('gameTabs.surveyProgressGeneralParent')
                          : ''
                      }}
                    </span>
                    <PvProgressBar :value="getGeneralSurveyProgress" :class="getGeneralSurveyProgressClass" />
                  </div>

                  <div v-if="props.userData.userType === 'parent'">
                    <div
                      v-for="(child, i) in props.userData?.childIds"
                      :key="child"
                      class="flex flex-wrap align-items-center mb-2"
                    >
                      <span class="mr-2 w-full sm:w-4 mb-1 sm:mb-0">
                        <b>{{ $t('gameTabs.surveyProgressSpecificParent') }} - </b>
                        {{ $t('gameTabs.surveyProgressSpecificParentMonth') }}:
                        {{ surveyStore.specificSurveyRelationData[i]?.birthMonth }}
                        <br class="sm:hidden" />
                        {{ $t('gameTabs.surveyProgressSpecificParentYear') }}:
                        {{ surveyStore.specificSurveyRelationData[i]?.birthYear }}
                      </span>
                      <PvProgressBar :value="getSpecificSurveyProgress(i)" :class="getSpecificSurveyProgressClass(i)" />
                    </div>
                  </div>

                  <div v-if="props.userData.userType === 'teacher'">
                    <div
                      v-for="(classroom, i) in props.userData?.classes?.current"
                      :key="classroom"
                      class="flex flex-wrap align-items-center mb-2"
                    >
                      <span class="mr-2 w-full sm:w-4 mb-1 sm:mb-0">
                        <b>Classroom - </b>
                        {{ surveyStore.specificSurveyRelationData[i]?.name }}
                      </span>
                      <PvProgressBar :value="getSpecificSurveyProgress(i)" :class="getSpecificSurveyProgressClass(i)" />
                    </div>
                  </div>
                </div>

                <div class="flex flex-column mt-auto">
                  <div class="roar-game-meta">
                    <PvTag
                      v-for="(items, metaIndex) in game.taskData.meta"
                      :key="metaIndex"
                      :value="metaIndex + ': ' + items"
                    />
                  </div>

                  <div v-if="selectedStatus === ASSIGNMENT_STATUSES.CURRENT">
                    <router-link
                      v-if="isTaskComplete(game?.completedOn, game?.taskId)"
                      class="game-btn --completed"
                      :to="{
                        path: getRoutePath(game.taskId, game.taskData?.variantURL, game.taskData?.taskURL),
                      }"
                      @click="routeExternalTask(game)"
                    >
                      <i class="pi pi-check-circle"></i>
                      <span>{{ $t('gameTabs.taskCompleted') }}</span>
                    </router-link>

                    <router-link
                      v-else
                      class="game-btn"
                      :to="{
                        path: getRoutePath(game.taskId, game.taskData?.variantURL, game.taskData?.taskURL),
                      }"
                      @click="routeExternalTask(game)"
                    >
                      <img src="@/assets/arrow-circle.svg" alt="arrow-circle" />
                      <span>{{ $t('gameTabs.clickToStart') }}</span>
                    </router-link>
                  </div>

                  <div v-if="selectedStatus === ASSIGNMENT_STATUSES.UPCOMING">
                    <div class="game-btn --disabled">
                      <i class="pi pi-hourglass"></i>
                      <span>Not yet available</span>
                    </div>
                  </div>

                  <div v-if="selectedStatus === ASSIGNMENT_STATUSES.PAST">
                    <div v-if="isTaskComplete(game?.completedOn, game?.taskId)" class="game-btn --disabled --completed">
                      <i class="pi pi-check-circle"></i>
                      <span>{{ $t('gameTabs.taskCompleted') }}</span>
                    </div>

                    <div v-else class="game-btn --disabled --incomplete">
                      <i class="pi pi-ban"></i>
                      <span>No longer available</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="roar-game-image" style="width: 35%">
              <div>
                <img
                  v-if="game.taskData.image"
                  :src="game.taskData.image"
                  style="width: 100%; object-fit: contain; height: 300px"
                />
                <img
                  v-else
                  src="https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png"
                  style="width: 100%; object-fit: contain; height: 300px"
                />
              </div>
            </div>
          </div>
        </PvTabPanel>
      </PvTabPanels>
    </PvTabs>
  </div>
</template>
<script setup lang="ts">
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
import { useSurveyStore } from '@/store/survey';
import _capitalize from 'lodash/capitalize';
import { useQueryClient } from '@tanstack/vue-query';
import { LEVANTE_SURVEY_RESPONSES_KEY } from '@/constants/bucket';
import PvProgressBar from 'primevue/progressbar';
import { useAssignmentsStore } from '@/store/assignments';
import { ASSIGNMENT_STATUSES } from '@/constants';

interface TaskData {
  name: string;
  description: string;
  image?: string;
  tutorialVideo?: string;
  variantURL?: string;
  taskURL?: string;
  meta?: Record<string, any>;
}

interface Game {
  taskId: string;
  completedOn?: string | Date;
  taskData: TaskData;
}

interface UserData {
  id: string;
  userType: string;
  birthMonth?: number;
  birthYear?: number;
  assessmentPid?: string;
  childIds?: string[];
  classes?: {
    current: string[];
  };
  schools?: {
    current: string[];
  };
}

interface Props {
  games: Game[];
  sequential?: boolean;
  userData: UserData;
}

interface VideoOptions {
  autoplay: boolean;
  controls: boolean;
  preload: boolean;
  fluid: boolean;
  sources: Array<{
    src: string;
    type: string;
  }>;
}

const props = withDefaults(defineProps<Props>(), {
  sequential: true,
});

const authStore = useAuthStore();
const gameStore = useGameStore();
const surveyStore = useSurveyStore();
const assignmentsStore = useAssignmentsStore();
const { selectedStatus } = storeToRefs(assignmentsStore);
const queryClient = useQueryClient();
const surveyData = queryClient.getQueryData(['surveyResponses', props.userData.id]);

const getGeneralSurveyProgress = computed((): number => {
  if (surveyStore.isGeneralSurveyComplete) return 100;
  if (!surveyStore.survey) return 0;
  return Math.round(((surveyStore.survey.currentPageNo - 1) / (surveyStore.numGeneralPages - 1)) * 100);
});

const getGeneralSurveyProgressClass = computed((): string => {
  if (getGeneralSurveyProgress.value > 0 && getGeneralSurveyProgress.value < 100) {
    return 'p-progressbar--started';
  }
  if (getGeneralSurveyProgress.value === 100) {
    return 'p-progressbar--completed';
  }
  return 'p-progressbar--empty';
});

const getSpecificSurveyProgress = computed(() => (loopIndex: number): number => {
  if (surveyStore.isSpecificSurveyComplete) return 100;

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

  // If data is not found in localStorage, use surveyData from server
  if (!surveyData || !Array.isArray(surveyData)) return 0;

  const currentSurvey = (surveyData as any[]).find((doc) => doc.administrationId === selectedAdmin.value.id);
  if (!currentSurvey || !currentSurvey.specific || !currentSurvey.specific[loopIndex]) return 0;

  // Specific survey is complete
  const specificSurvey = currentSurvey.specific[loopIndex];
  if (specificSurvey.isComplete) return 100;

  // Specific survey is incomplete
  const currentPage = currentSurvey.pageNo || 0;
  const totalPages = surveyStore.numSpecificPages || 1;

  return Math.round((currentPage / totalPages) * 100);
});

const getSpecificSurveyProgressClass = computed(() => (loopIndex: number): string => {
  const value = getSpecificSurveyProgress.value(loopIndex);
  if (value > 0 && value < 100) {
    return 'p-progressbar--started';
  }
  if (value === 100) {
    return 'p-progressbar--completed';
  }
  return 'p-progressbar--empty';
});

const { t, locale } = useI18n();

const levanteTasks: string[] = [
  'intro',
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
  'vocab',
];

const getTaskName = (taskId: string, taskName: string): string => {
  // Translate Levante task names. The task name is not the same as the taskId.
  const taskIdLowercased = taskId.toLowerCase();

  if (taskIdLowercased === 'survey') {
    if (props.userData.userType === 'teacher' || props.userData.userType === 'parent') {
      return t(`gameTabs.surveyName${_capitalize(props.userData.userType)}Part1`);
    } else {
      // child
      return t('gameTabs.surveyNameChild');
    }
  }

  if (levanteTasks.includes(camelize(taskIdLowercased))) {
    return t(`gameTabs.${camelize(taskIdLowercased)}Name`);
  }
  return taskName;
};

const getTaskDescription = (taskId: string, taskDescription: string): string => {
  // Translate Levante task descriptions if not in English
  const taskIdLowercased = taskId.toLowerCase();

  if (taskIdLowercased === 'survey') {
    if (props.userData.userType === 'teacher' || props.userData.userType === 'parent') {
      return t(`gameTabs.surveyDescription${_capitalize(props.userData.userType)}Part1`);
    } else {
      // child
      return t('gameTabs.surveyDescriptionChild');
    }
  }

  if (levanteTasks.includes(camelize(taskIdLowercased))) {
    return t(`gameTabs.${camelize(taskIdLowercased)}Description`);
  }
  return taskDescription;
};

const getRoutePath = (taskId: string, variantURL?: string, taskURL?: string): string => {
  // do not navigate if the task is external
  if (variantURL || taskURL) return '/';

  const lowerCasedAndCamelizedTaskId = camelize(taskId.toLowerCase());

  if (lowerCasedAndCamelizedTaskId === 'survey') {
    return '/survey';
  } else if (levanteTasks.includes(lowerCasedAndCamelizedTaskId)) {
    return '/game/core-tasks/' + taskId;
  } else {
    return '/game/' + taskId;
  }
};

const taskCompletedMessage = computed((): string => {
  return t('gameTabs.taskCompleted');
});

const currentGameId = computed((): string | undefined => {
  return _get(
    _find(props.games, (game) => {
      return game.completedOn === undefined;
    }),
    'taskId',
  );
});

const gameIndex = computed((): number =>
  _findIndex(props.games, (game) => {
    return game.taskId === currentGameId.value;
  }),
);

const displayGameIndex = computed((): number => (gameIndex.value === -1 ? 0 : gameIndex.value));

const allGamesComplete = computed((): boolean => gameIndex.value === -1);

const { selectedAdmin } = storeToRefs(gameStore);

async function routeExternalTask(game: Game): Promise<void> {
  let url: string;

  if (game.taskData?.variantURL) {
    url = game.taskData.variantURL;
  } else if (game.taskData?.taskURL) {
    url = game.taskData.taskURL;
  } else {
    // Not an external task
    return;
  }

  if (game.taskData.name.toLowerCase() === 'mefs') {
    const ageInMonths = getAgeData(props.userData.birthMonth, props.userData.birthYear).ageMonths;
    url += `participantID=${props.userData.id}&participantAgeInMonths=${ageInMonths}&lng=${locale.value}`;
    window.open(url, '_blank')?.focus();
    await (authStore as any).completeAssessment(selectedAdmin.value.id, game.taskId);
  } else {
    url += `&participant=${props.userData.assessmentPid}${
      props.userData.schools?.current?.length ? '&schoolId=' + props.userData.schools.current.join('"%2C"') : ''
    }${props.userData.classes?.current?.length ? '&classId=' + props.userData.classes.current.join('"%2C"') : ''}`;

    await (authStore as any).completeAssessment(selectedAdmin.value.id, game.taskId);
    window.location.href = url;
  }
}

const returnVideoOptions = (videoURL: string): VideoOptions => {
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

const isTaskComplete = (gameCompletedTime: string | Date | undefined, taskId: string): boolean => {
  if (taskId === 'survey') {
    if (props.userData.userType === 'teacher' || props.userData.userType === 'parent') {
      if (!surveyStore.isGeneralSurveyComplete) {
        return false;
      } else if (surveyStore.specificSurveyRelationData.length > 0 && !surveyStore.isSpecificSurveyComplete) {
        return false;
      } else {
        return true;
      }
    } else {
      // child
      return surveyStore.isGeneralSurveyComplete;
    }
  }

  return gameCompletedTime ? true : false;
};
</script>

<style scoped lang="scss">
.game-tab-container {
  width: 80vw;
  min-width: 800px;
  max-width: 1200px;
}

.pointer {
  cursor: pointer;
}

.video-player-wrapper {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.roar-tabview-game {
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 400px;
  border-radius: 10px;
}

.roar-game-image {
  flex: 0 0 35%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.roar-game-content {
  flex: 0 0 65%;
  padding-right: 2rem;
  display: flex;
  flex-direction: column;
}

.roar-game-description {
  margin-bottom: 1rem;
  flex-grow: 1;
}

.roar-game-footer {
  margin-top: auto;
  width: 100%;
  text-align: center;
}

.game-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  padding: 1rem;
  background: transparent;
  border: 1px solid var(--surface-200);
  border-radius: 0.5rem;
  font-weight: 700;
  font-size: 1.125rem;
  color: inherit;
  text-decoration: none;
  user-select: none;

  .pi {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 24px;
    height: 24px;
    margin: 0;
    padding: 0;
    border-radius: 100%;
    background: transparent;
    font-weight: 900;
    font-size: 12px;
    color: white;
  }

  &:hover {
    background: var(--surface-200);
  }

  &.--disabled {
    cursor: not-allowed;
    border: 1px solid rgba(var(--bright-yellow-rgb), 0.3);

    .pi {
      background: var(--bright-yellow);
    }

    &:hover {
      background: transparent;
    }
  }

  &.--completed {
    border: none;
    background: rgba(var(--bright-green-rgb), 0.1);

    .pi {
      background: var(--bright-green);
    }

    &:hover {
      background: rgba(var(--bright-green-rgb), 0.1);
    }
  }

  &.--incomplete {
    border: none;
    background: rgba(var(--bright-red-rgb), 0.1);

    .pi {
      background: var(--bright-red);
    }

    &:hover {
      background: rgba(var(--bright-red-rgb), 0.1);
    }
  }
}

.p-progressbar {
  flex-grow: 1;
  width: 100%;

  &.p-progressbar--started :deep(.p-progressbar-value) {
    background-color: var(--yellow-400);
  }

  &.p-progressbar--completed :deep(.p-progressbar-value) {
    background-color: var(--green-500);
  }
}

@media screen and (max-width: 800px) {
  .game-tab-container {
    width: 100%;
    min-width: 100%;
  }

  .roar-tabview-game {
    flex-direction: column;
    min-height: auto;
  }

  .roar-game-image,
  .roar-game-content {
    flex: 0 0 100%;
    width: 100%;
    padding-right: 0;
  }

  .roar-game-image {
    margin-top: 1rem;
  }

  .video-player-wrapper {
    width: 100%;
    height: 250px;
  }
}
</style>
