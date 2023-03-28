<template>
  <div id="games">
    <RoarGameCard title="ROAR PA" description="Some description" imgSrc="https://reading.stanford.edu/wp-content/uploads/2021/10/PA-1024x512.png" :metadata="testData"></RoarGameCard>
  </div>
</template>

<script setup>
  import RoarGameCard from '@/components/RoarGameCard.vue';
  import {ref} from "vue"; 
  const testData = ref({
    version: "12345",
    coins: "1M"
  });
</script>

<style scoped>
  #games {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
</style>