<template>
  <div id="games">
    <TabView v-model:activeIndex="activeGame">
      <TabPanel v-for="game in games" :key="game.id" :disabled="!game.completed && (currentGameId !== game.id)">
        <template #header>
          <!--Complete Game-->
          <i v-if="game.completed" class="pi pi-check-circle mr-2" data-game-status="complete" />
          <!--Current Game-->
          <i v-else-if="game.id == currentGameId" class="pi pi-circle mr-2" data-game-status="current" />
          <!--Locked Game-->
          <i v-else class="pi pi-lock mr-2" data-game-status="incomplete" />
          <span class="tabview-nav-link-label" :data-game-status="`${game.completed ? 'complete' : 'incomplete'}`">{{ game.title }}</span>
        </template>
        <article class="roar-tabview-game">
            <div class="roar-game-content">
              <h2 class="roar-game-title" v-tooltip="'test'">{{ game.title }}</h2>
              <div class="roar-game-description"><p>{{game.description}}</p></div>
              <div class="roar-game-meta">
                <Tag v-for="(items,index) in game.metadata" :value="index + ': ' + items"></Tag>
              </div>
              <div class="roar-game-footer">
                <i class="pi"><svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="42" height="42" rx="21" fill="#A80532"/>
                  <path d="M26.1858 19.6739L17.4823 14.1736C16.7751 13.7269 15.6921 14.1604 15.6921 15.2652V26.2632C15.6921 27.2544 16.6985 27.8518 17.4823 27.3549L26.1858 21.8572C26.9622 21.3682 26.9647 20.1629 26.1858 19.6739Z" fill="white"/>
                  </svg></i>
                <span>Click to start</span>
              </div>
            </div>
            <div class="roar-game-image">
              <img :src="game.imgSrc"/>
            </div>
            <router-link :to="{ path: 'game/' + game.id }"></router-link>
        </article>
      </TabPanel>
    </TabView>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import _get from 'lodash/get'
const props = defineProps({
  games: {required: true, default: {}}
})
const currentGameId = ref('')

for(let i = 0; i < props.games.length; i+=1) {
  if(!_get(props.games[i], 'completed')){
    currentGameId.value = _get(props.games[i], 'id');
    break;
  }
}
</script>
<style scoped lang="scss">

.play-button {
  background-color: green;
  color: white;
  margin: 1rem;
  padding: 4rem 6rem 4rem 6rem;
  border-radius: 1rem;
  font-size: 2rem;
}
</style>