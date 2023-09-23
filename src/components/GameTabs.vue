<template>
  <div id="games">
    <TabView v-model:activeIndex="currentGameIndex">
      <TabPanel v-for="game in games" :key="game.taskData.taskId" :disabled="(sequential && allGamesComplete && (!game.completedOn || allGamesComplete) && (currentGameId !== game.taskId))">
        <template #header>
          <!--Complete Game-->
          <i v-if="game.completedOn" class="pi pi-check-circle mr-2" data-game-status="complete" />
          <!--Current Game-->
          <i v-else-if="game.taskId == currentGameId || !sequential" class="pi pi-circle mr-2" data-game-status="current" />
          <!--Locked Game-->
          <i v-else-if="sequential" class="pi pi-lock mr-2" data-game-status="incomplete" />
          <span class="tabview-nav-link-label" :data-game-status="`${game.completedOn ? 'complete' : 'incomplete'}`">{{ game.taskData.name }}</span>
        </template>
        <article class="roar-tabview-game">
            <div class="roar-game-content">
              <h2 class="roar-game-title">{{ game.taskData.name }}</h2>
              <div class="roar-game-description"><p>{{game.taskData.description}}</p></div>
              <div class="roar-game-meta">
                <Tag v-for="(items,index) in game.taskData.meta" :value="index + ': ' + items"></Tag>
              </div>
              <div class="roar-game-footer">
                <i v-if="!allGamesComplete" class="pi"><svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="42" height="42" rx="21" fill="#A80532"/>
                  <path d="M26.1858 19.6739L17.4823 14.1736C16.7751 13.7269 15.6921 14.1604 15.6921 15.2652V26.2632C15.6921 27.2544 16.6985 27.8518 17.4823 27.3549L26.1858 21.8572C26.9622 21.3682 26.9647 20.1629 26.1858 19.6739Z" fill="white"/>
                  </svg></i>
                <span v-if="!allGamesComplete">Click to start</span>
                <span v-else>Task Completed!</span>
              </div>
            </div>
            <div class="roar-game-image">
              <img v-if="game.taskData.image" :src="game.taskData.image">
              <!-- TODO: Get real backup image -->
              <img v-else src="https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png"/>
            </div>
            <router-link v-if="!allGamesComplete && !game.taskData.taskURL" :to="{ path: 'game/' + game.taskId }"></router-link>
            <router-link v-else :to="{ path: game.taskData.taskURL }"></router-link>
        </article>
      </TabPanel>
    </TabView>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue';
import _get from 'lodash/get'
import _find from 'lodash/find'
import _findIndex from 'lodash/findIndex'
const props = defineProps({
  games: {required: true, default: []},
  sequential: {required: false, default: true}
})

const selectedIndex = ref(0);
const allGamesComplete = ref(false);

const currentGameId = computed(() => {
  return _get(_find(props.games, (game) => { return (game.completedOn === undefined) }), 'taskId')
})

const currentGameIndex = computed(() => {
  const gameIndex = _findIndex(props.games, (game) => { return (game.taskId === currentGameId.value) })
  if(gameIndex === -1){
    allGamesComplete.value = true;
    return 0
  } else {
    allGamesComplete.value = false;
    return gameIndex
  }
})
</script>
<style scoped lang="scss">

</style>