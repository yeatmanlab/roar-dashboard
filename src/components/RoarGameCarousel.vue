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
  <Button @click="scrollLeft" >&lt;</Button>
  <Button @click="scrollRight">></Button>
</template>
<script setup>
import { ref, onMounted } from "vue";
import RoarGameCard from '@/components/RoarGameCard.vue';

const props = defineProps({
  items: {required: true, default: {}},
  focusIndex: {required: false, default: 1}
})
const gameContainer = ref(null);
const cardList = ref(null)
let currentCardIndex = props.focusIndex - 1;

onMounted(() => {
  scrollToCard(props.focusIndex - 1)
})

function scrollToCard(index){
  console.log('trying to scroll to card', index)
  if(index <= cardList.value.length-1 && index > -1){
    const scrollObject = cardList.value[index]
    const scrollOffset = scrollObject.offsetLeft
    console.log('scrollOffset', scrollOffset)
    gameContainer.value.scrollTo({
      left: scrollOffset,
      behavior: 'smooth'
    })
    currentCardIndex = index
  }
}

function getScrollWidth() {
  return cardList.value[0].scrollWidth;
}

function scrollLeft() {
  scrollToCard(currentCardIndex-1)
}
function scrollRight() {
  scrollToCard(currentCardIndex+1)
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