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
              (allGamesComplete &&
                currentGameId !== game.taskId &&
                !game.completedOn))
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
          <i
            v-if="sequential"
            class="pi pi-lock mr-2"
            data-game-status="incomplete"
          />
          <span
            class="tabview-nav-link-label"
            :data-game-status="`${
              isTaskComplete(game.completedOn, game.taskId)
                ? 'complete'
                : 'incomplete'
            }`"
            >{{ getTaskName(game.taskId, game.taskData.name) }}</span
          >
        </PvTab>
      </PvTabList>
      <PvTabPanels
        style="
          width: 80vw;
          min-width: 800px;
          max-width: 1200px;
          margin-top: 0.5rem;
          padding: 0;
        "
      >
        <PvTabPanel
          v-for="(game, index) in games"
          :key="game.taskId"
          :disabled="
            sequential &&
            ((index > 0 && !games[index - 1].completedOn) ||
              (allGamesComplete &&
                currentGameId !== game.taskId &&
                !game.completedOn))
          "
          :value="String(index)"
          class="p-0"
        >
          <div
            class="roar-tabview-game pointer flex flex-row p-5 surface-100 w-full"
          >
            <div class="roar-game-content flex flex-column" style="width: 65%">
              <div class="flex flex-column h-full">
                <div class="roar-game-title font-bold">
                  {{ getTaskName(game.taskId, game.taskData.name) }}
                </div>
                <div class="roar-game-description mr-2 flex-grow-1">
                  <p>
                    {{
                      getTaskDescription(game.taskId, game.taskData.description)
                    }}
                  </p>
                </div>

                <div v-if="game.taskId === 'survey'" class="mt-4 mb-4">
                  <div class="flex align-items-center mb-2">
                    <span class="mr-2 w-4"
                      ><b>{{ $t("gameTabs.surveyProgressGeneral") }} </b> -
                      {{
                        props.userData.userType === "teacher" ||
                        props.userData.userType === "parent"
                          ? props.userData.userType === "teacher"
                            ? $t("gameTabs.surveyProgressGeneralTeacher")
                            : $t("gameTabs.surveyProgressGeneralParent")
                          : ""
                      }}
                    </span>
                    <PvProgressBar
                      :value="getGeneralSurveyProgress"
                      :class="getGeneralSurveyProgressClass"
                    />
                  </div>

                  <div v-if="props.userData.userType === 'parent'">
                    <div
                      v-for="(child, i) in props.userData?.childIds"
                      :key="child"
                      class="flex flex-wrap align-items-center mb-2"
                    >
                      <span class="mr-2 w-full sm:w-4 mb-1 sm:mb-0">
                        <b
                          >{{ $t("gameTabs.surveyProgressSpecificParent") }} -
                        </b>
                        {{ $t("gameTabs.surveyProgressSpecificParentMonth") }}:
                        {{
                          surveyStore.specificSurveyRelationData[i]?.birthMonth
                        }}
                        <br class="sm:hidden" />
                        {{ $t("gameTabs.surveyProgressSpecificParentYear") }}:
                        {{
                          surveyStore.specificSurveyRelationData[i]?.birthYear
                        }}
                      </span>
                      <PvProgressBar
                        :value="getSpecificSurveyProgress(i)"
                        :class="getSpecificSurveyProgressClass"
                      />
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
                      <PvProgressBar
                        :value="getSpecificSurveyProgress(i)"
                        :class="getSpecificSurveyProgressClass"
                      />
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
                  <router-link
                    v-if="!isTaskComplete(game.completedOn, game.taskId)"
                    class="roar-game-footer p-3 hover:surface-200 no-underline text-900"
                    :to="{
                      path: getRoutePath(
                        game.taskId,
                        game.taskData?.variantURL,
                        game.taskData?.taskURL,
                      ),
                    }"
                    @click="routeExternalTask(game)"
                  >
                    <div
                      class="flex align-items-center justify-content-center text-xl font-bold mt-2"
                    >
                      <i class="pi">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 42 42"
                          fill="none"
                          class="mr-3"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect width="42" height="42" rx="21" fill="#A80532" />
                          <path
                            d="M26.1858 19.6739L17.4823 14.1736C16.7751 13.7269 15.6921 14.1604 15.6921 15.2652V26.2632C15.6921 27.2544 16.6985 27.8518 17.4823 27.3549L26.1858 21.8572C26.9622 21.3682 26.9647 20.1629 26.1858 19.6739Z"
                            fill="white"
                          />
                        </svg>
                      </i>
                      <span>{{ $t("gameTabs.clickToStart") }}</span>
                    </div>
                  </router-link>
                  <div v-else>
                    <div
                      class="flex align-items-center justify-content-center text-green-500 roar-game-footer p-3 no-underline text-900 text-xl font-bold"
                    >
                      <i
                        v-if="game.completedOn"
                        class="pi pi-check-circle mr-3"
                      />
                      <span>{{ taskCompletedMessage }} </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="roar-game-image" style="width: 35%">
              <div
                v-if="game.taskData?.tutorialVideo"
                class="video-player-wrapper"
              >
                <VideoPlayer
                  :options="returnVideoOptions(game.taskData?.tutorialVideo)"
                  :on-video-end="updateVideoCompleted"
                  :on-video-start="updateVideoStarted"
                  :task-id="game.taskId"
                  style="width: 100%"
                />
              </div>
              <div v-else>
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
<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import _get from "lodash/get";
import _find from "lodash/find";
import _findIndex from "lodash/findIndex";
import { camelize, getAgeData } from "@bdelab/roar-utils";
import PvTabPanel from "primevue/tabpanel";
import PvTabs from "primevue/tabs";
import PvTabList from "primevue/tablist";
import PvTab from "primevue/tab";
import PvTabPanels from "primevue/tabpanels";
import PvTag from "primevue/tag";
import { useAuthStore } from "@/store/auth";
import { useGameStore } from "@/store/game";
import { useSurveyStore } from "@/store/survey";
import VideoPlayer from "@/components/VideoPlayer.vue";
import { isLevante } from "@/helpers";
import _capitalize from "lodash/capitalize";
import { useQueryClient } from "@tanstack/vue-query";
import { LEVANTE_SURVEY_RESPONSES_KEY } from "@/constants/bucket";
import PvProgressBar from "primevue/progressbar";

const props = defineProps({
  games: { type: Array, required: true },
  sequential: { type: Boolean, required: false, default: true },
  userData: { type: Object, required: true },
});

const authStore = useAuthStore();
const gameStore = useGameStore();
const surveyStore = useSurveyStore();
const queryClient = useQueryClient();
const surveyData = queryClient.getQueryData([
  "surveyResponses",
  props.userData.id,
]);

const getGeneralSurveyProgress = computed(() => {
  if (surveyStore.isGeneralSurveyComplete) return 100;
  if (!surveyStore.survey) return 0;
  return Math.round(
    ((surveyStore.survey.currentPageNo - 1) /
      (surveyStore.numGeneralPages - 1)) *
      100,
  );
});

const getGeneralSurveyProgressClass = computed(() => {
  if (
    getGeneralSurveyProgress.value > 0 &&
    getGeneralSurveyProgress.value < 100
  ) {
    return "p-progressbar--started";
  }
  if (getGeneralSurveyProgress.value === 100) {
    return "p-progressbar--completed";
  }
  return "p-progressbar--empty";
});

const getSpecificSurveyProgressClass = computed(() => {
  if (
    getSpecificSurveyProgress.value > 0 &&
    getSpecificSurveyProgress.value < 100
  ) {
    return "p-progressbar--started";
  }
  if (getSpecificSurveyProgress.value === 100) {
    return "p-progressbar--completed";
  }
  return "p-progressbar--empty";
});

const getSpecificSurveyProgress = computed(() => (loopIndex) => {
  if (surveyStore.isSpecificSurveyComplete) return 100;

  const localStorageKey = `${LEVANTE_SURVEY_RESPONSES_KEY}-${props.userData.id}`;
  const localStorageData = JSON.parse(
    localStorage.getItem(localStorageKey) || "{}",
  );

  if (localStorageData && surveyStore.specificSurveyRelationData[loopIndex]) {
    const specificIdFromServer =
      surveyStore.specificSurveyRelationData[loopIndex].id;

    if (specificIdFromServer === localStorageData.specificId) {
      if (localStorageData.isComplete) return 100;

      const currentPage = localStorageData.pageNo || 0;
      const totalPages = surveyStore.numSpecificPages || 1;

      return Math.round((currentPage / totalPages) * 100);
    }
  }

  // If data is not found in localStorage, use surveyData from server
  if (!surveyData || !Array.isArray(surveyData)) return 0;

  const currentSurvey = surveyData.find(
    (doc) => doc.administrationId === selectedAdmin.value.id,
  );
  if (
    !currentSurvey ||
    !currentSurvey.specific ||
    !currentSurvey.specific[loopIndex]
  )
    return 0;

  // Specific survey is complete
  const specificSurvey = currentSurvey.specific[loopIndex];
  if (specificSurvey.isComplete) return 100;

  // Specific survey is incomplete
  const currentPage = currentSurvey.pageNo || 0;
  const totalPages = surveyStore.numSpecificPages || 1;

  return Math.round((currentPage / totalPages) * 100);
});

const { t, locale } = useI18n();

const levanteTasks = [
  "intro",
  "heartsAndFlowers",
  "egmaMath",
  "matrixReasoning",
  "memoryGame",
  "mentalRotation",
  "sameDifferentSelection",
  "theoryOfMind",
  "trog",
  "survey",
  "mefs",
  "roarInference",
];

const levantifiedRoarTasks = [
  "vocab",
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

  if (taskIdLowercased === "survey") {
    if (
      props.userData.userType === "teacher" ||
      props.userData.userType === "parent"
    ) {
      return t(
        `gameTabs.surveyName${_capitalize(props.userData.userType)}Part1`,
      );
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

  if (taskIdLowercased === "survey") {
    if (
      props.userData.userType === "teacher" ||
      props.userData.userType === "parent"
    ) {
      return t(
        `gameTabs.surveyDescription${_capitalize(
          props.userData.userType,
        )}Part1`,
      );
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

const getRoutePath = (taskId, variantURL, taskURL) => {
  // do not navigate if the task is external
  if (variantURL || taskURL) return "/";

  const lowerCasedAndCamelizedTaskId = camelize(taskId.toLowerCase());

  if (lowerCasedAndCamelizedTaskId === "survey") {
    return "/survey";
  } else if (
    levanteTasks.includes(lowerCasedAndCamelizedTaskId) ||
    (isLevante && levantifiedRoarTasks.includes(lowerCasedAndCamelizedTaskId))
  ) {
    return "/game/core-tasks/" + taskId;
  } else {
    return "/game/" + taskId;
  }
};

const taskCompletedMessage = computed(() => {
  return t("gameTabs.taskCompleted");
});

const updateVideoStarted = async (taskId) => {
  try {
    await authStore.roarfirekit.updateVideoMetadata(
      selectedAdmin.value.id,
      taskId,
      "started",
    );
  } catch (e) {
    console.error("Error while updating video completion", e);
  }
};

const updateVideoCompleted = async (taskId) => {
  try {
    await authStore.roarfirekit.updateVideoMetadata(
      selectedAdmin.value.id,
      taskId,
      "completed",
    );
  } catch (e) {
    console.error("Error while updating video completion", e);
  }
};

const currentGameId = computed(() => {
  return _get(
    _find(props.games, (game) => {
      return game.completedOn === undefined;
    }),
    "taskId",
  );
});

const gameIndex = computed(() =>
  _findIndex(props.games, (game) => {
    return game.taskId === currentGameId.value;
  }),
);

const displayGameIndex = computed(() =>
  gameIndex.value === -1 ? 0 : gameIndex.value,
);
const allGamesComplete = computed(() => gameIndex.value === -1);

const { selectedAdmin } = storeToRefs(gameStore);

async function routeExternalTask(game) {
  let url;

  if (game.taskData?.variantURL) {
    url = game.taskData.variantURL;
  } else if (game.taskData?.taskURL) {
    url = game.taskData.taskURL;
  } else {
    // Not an external task
    return;
  }

  if (game.taskData.name.toLowerCase() === "mefs") {
    const ageInMonths = getAgeData(
      props.userData.birthMonth,
      props.userData.birthYear,
    ).ageMonths;
    url += `participantID=${props.userData.id}&participantAgeInMonths=${ageInMonths}&lng=${locale.value}`;
    window.open(url, "_blank").focus();
    await authStore.completeAssessment(selectedAdmin.value.id, game.taskId);
  } else {
    url += `&participant=${props.userData.assessmentPid}${
      props.userData.schools.length
        ? "&schoolId=" + props.userData.schools.current.join('"%2C"')
        : ""
    }${
      props.userData.classes.current.length
        ? "&classId=" + props.userData.classes.current.join('"%2C"')
        : ""
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
        type: "video/mp4",
      },
    ],
  };
};

const isTaskComplete = (gameCompletedTime, taskId) => {
  if (taskId === "survey") {
    if (
      props.userData.userType === "teacher" ||
      props.userData.userType === "parent"
    ) {
      if (!surveyStore.isGeneralSurveyComplete) {
        return false;
      } else if (
        surveyStore.specificSurveyRelationData.length > 0 &&
        !surveyStore.isSpecificSurveyComplete
      ) {
        return false;
      } else {
        return true;
      }
    } else {
      // child
      if (surveyStore.isGeneralSurveyComplete) {
        return true;
      } else {
        return false;
      }
    }
  }

  if (gameCompletedTime) {
    return true;
  } else {
    return false;
  }
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
  background-color: #f0f0f0;
  border-radius: 4px;
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
