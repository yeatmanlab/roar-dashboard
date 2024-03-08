<template>
  <div id="games">
    <PvTabView v-model:activeIndex="displayGameIndex">
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
            game.taskData.name
          }}</span>
        </template>
        <article class="roar-tabview-game pointer">
          <div class="roar-game-content" @click="routeExternalTask(game)">
            <h2 class="roar-game-title">{{ game.taskData.name }}</h2>
            <div class="roar-game-description">
              <p>{{ game.taskData.description }}</p>
            </div>
            <div class="roar-game-meta">
              <PvTag
                v-for="(items, metaIndex) in game.taskData.meta"
                :key="metaIndex"
                :value="metaIndex + ': ' + items"
              />
            </div>
            <div class="roar-game-footer">
              <i v-if="!allGamesComplete" class="pi"
                ><svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                :to="{ path: 'game/' + game.taskId }"
              ></router-link>
            </div>
          </div>
          <div class="roar-game-image">
            <div v-if="game.taskData?.tutorialVideo" class="video-player-wrapper">
              <VideoPlayer :options="returnVideoOptions(game.taskData?.tutorialVideo)" />
            </div>
            <div v-else>
              <img v-if="game.taskData.image" :src="game.taskData.image" />
              <!-- TODO: Get real backup image -->
              <img v-else src="https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png" />
            </div>
          </div>
        </article>
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
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import VideoPlayer from '@/components/VideoPlayer.vue';

const { t } = useI18n();

const taskCompletedMessage = computed(() => {
  return t('gameTabs.taskCompleted');
});

const props = defineProps({
  games: { type: Array, required: true },
  sequential: { type: Boolean, required: false, default: true },
  userData: { type: Object, required: true },
});

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

  url += `&participant=${props.userData.assessmentPid}${
    props.userData.schools.length ? '&schoolId=' + props.userData.schools.current.join('“%2C”') : ''
  }${props.userData.classes.current.length ? '&classId=' + props.userData.classes.current.join('“%2C”') : ''}`;

  await authStore.completeAssessment(selectedAdmin.value.id, game.taskId);

  window.location.href = url;
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
.pointer {
  cursor: pointer;
}

.video-player-wrapper {
  // display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 30rem;
  min-height: 100%;
}
</style>
