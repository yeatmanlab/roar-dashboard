<template>
  <div id="games" ref="gameContainer">
    <div v-for="(item, index) in items">
      <div ref="cardList">
        <RoarGameCard
          id="card"
          :gameId="item.id"
          :title="item.title" 
          :description="item.description" 
          :imgSrc="item.imgSrc"
          :metadata="item.metadata" 
          :completed="item.completed"
        />
      </div>
    </div>
  </div>
  <Button @click="scrollLeft" :disabled="!canScrollLeft">&lt;</Button>
  <Button @click="scrollRight" :disabled="!canScrollRight">></Button>
</template>
<script setup>
import { ref, onMounted } from "vue";
import _forEach from 'lodash/forEach'
import RoarGameCard from '@/components/RoarGameCard.vue';

const props = defineProps({
  items: {required: true, default: {}},
  focusIndex: {required: false, default: 1}
})
const gameContainer = ref(null);
const cardList = ref(null)
let currentCardIndex = props.focusIndex - 1;
let canScrollLeft = ref(true);
let canScrollRight = ref(true);

onMounted(() => {
  scrollToCard(props.focusIndex - 1);
  checkScrollAbility();
})

function scrollToCard(index){
  console.log('trying to scroll to game', index+1)
  if(index <= cardList.value.length-1 && index > -1){
    const scrollObject = cardList.value[index]
    // The card's offset - 1/2 screen width + 1/2 the card width
    // const scrollOffset = scrollObject.offsetLeft - (window.innerWidth * 0.5) + (scrollObject.offsetWidth * 0.5)
    const scrollOffset = scrollObject.offsetLeft
    gameContainer.value.scrollTo({
      left: scrollOffset,
      behavior: 'smooth'
    })
    currentCardIndex = index
  }
}

function checkScrollAbility(){
  canScrollLeft.value = (currentCardIndex > 0)
  canScrollRight.value = (currentCardIndex < cardList.value.length - 1)
}

function scrollLeft() {
  scrollToCard(currentCardIndex-1)
  checkScrollAbility()
}
function scrollRight() {
  scrollToCard(currentCardIndex+1)
  checkScrollAbility()
}

function findClosestIndex() {
  let lowestOffset = Infinity
  for(let index = 0; index <= cardList.value.length; index++){
    const currentOffset = cardList.value[index].offsetLeft;
    lowestOffset = (lowestOffset > currentOffset) ? lowestOffset : currentOffset;
  }
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
    width: 100%;
    overflow: scroll;
    // padding-left: 30rem;   // temporary to allow for centering cards
    // padding-right: 30rem;  // ^
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