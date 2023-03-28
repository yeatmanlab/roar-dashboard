<template>
  <div id="games" ref="gameContainer">
    <div v-for="(item, index) in items">
      <RoarGameCard
        id="card"
        ref="cardList"
        :title="item.title" 
        :description="item.description" 
        :imgSrc="item.imgSrc"
        :metadata="item.metadata" 
      />
    </div>
  </div>
  <Button @click="scrollLeft" >&lt;</Button>
  <Button @click="scrollRight">></Button>
</template>
<script setup>
import { ref } from "vue";
import RoarGameCard from '@/components/RoarGameCard.vue';

const props = defineProps({
  items: {required: true, default: {}}
})
const gameContainer = ref(null);
const cardList = ref(null)
let currentScroll = 0;

function getScrollWidth() {
  return 398;
}

function scrollLeft() {
  gameContainer.value.scrollTo({
    top: 0,
    left: currentScroll -= getScrollWidth(),
    behavior: 'smooth'
  })
}
function scrollRight() {
  gameContainer.value.scrollTo({
    left: currentScroll += getScrollWidth(),
    behavior: 'smooth'
  })
}
</script>
<style scoped>
  #card {
    width: 30vw;
    min-width: 350px;
    max-width: 550px;
  }
  #games {
    display: inline-flex;
    flex-direction: 'row';
    width: 100%;
    overflow: scroll;
  }
</style>