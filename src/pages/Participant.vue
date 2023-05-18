<template>
  <!-- <RoarGameList :items="testData" :focusIndex="3"/> -->
  <!-- <GameAccordian :games="testData"/> -->
  <div v-if="useTabs" class="tabs-container">
    <ParticipantSidebar :total-games="gamesTotal" :completed-games="gamesCompleted" :student-info="studentInfo" />
    <GameTabs :games="testData" />
  </div>
</template>

<script setup>
import {ref} from "vue";
// TODO: delete game list and accordian files 
import RoarGameList from "../components/RoarGameList.vue";
import GameAccordian from "../components/GameAccordian.vue";
import GameTabs from "../components/GameTabs.vue";
import ParticipantSidebar from "../components/ParticipantSidebar.vue";
import _filter from 'lodash/filter'
import _get from 'lodash/get'
const useTabs = ref(true);
const testData = ref([
  {
    id: "id-1",
    title: "Game 1",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4"
    },
    completed: true
  },
  {
    id: "id-2",
    title: "Game 2",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "32K"
    },
    completed: true
  },
  {
    id: "id-3",
    title: "Game 3",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "1M"
    },
    completed: false
  },
  {
    id: "id-4",
    title: "Game 4",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4M"
    },
    completed: false
  },
  {
    id: "id-5",
    title: "Game 5",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4M"
    },
    completed: false
  },
  {
    id: "id-6",
    title: "Game 6",
    description: "Tell the difference between the magical language of Lexicality and English to reach the gate back to Earth!",
    imgSrc: "https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png",
    metadata: {
      version: "1.2.3",
      coins: "4M"
    },
    completed: false
  },
]);
const studentInfo = ref({
  group: 'Woodside',
  age: 8,
  grade: 4,
})
const numCompleted = _filter(testData.value, game => {
  return _get(game, 'completed')
}).length
const gamesTotal = ref(testData.value.length)
const gamesCompleted = ref(numCompleted)
</script>
<style scoped>
.tabs-container {
  display: flex;
  flex-direction: row;
  padding: 2rem;
  gap: 2rem;
}
@media screen and (max-width: 1100px) {
  .tabs-container {
    flex-direction: column;
  }
}

</style>