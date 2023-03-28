<template>
  <div id="games" ref="gameContainer">
    <template v-for="(item, index) in items">
      <RoarGameCard
        ref="cardList"
        :gameId="item.id"
        :title="item.title" 
        :description="item.description" 
        :imgSrc="item.imgSrc"
        :metadata="item.metadata" 
        :completed="item.completed"
      />
    </template>
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
<style scoped lang="scss">
  .p-card-game {
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
  
  [data-completed="true"] {
    opacity: 0.5;
    filter: grayscale(1);
    
    + [data-completed="false"] {
      transform: scale(1.05);
      
      & ~ [data-completed="false"] {
        opacity: 0.75;
        
        &:hover {
          opacity: 1;
        }
      }
    }
  }
</style>