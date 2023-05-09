<template>
  <div>
    <TabView>
      <TabPanel v-for="game in games" :key="game.id">
        <template #header>
          <i v-if="game.completed" class="pi pi-check-circle mr-2" style="color: green" />
          <i v-else class="pi pi-circle mr-2" style="color: red" />
          <span :style="`color: ${game.completed ? 'green' : 'red'}`">{{ game.title }}</span>
        </template>
        <div class="flex flex-row">
          <img :src="game.imgSrc" class="image"/>
          <div>
            <div class="play-button">
              Play
            </div>
          </div>
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>
<script setup>
const props = defineProps({
  games: {required: true, default: {}}
})
</script>
<style scoped>
.image {
  max-width: 50%
}
.play-button {
  background-color: green;
  color: white;
  margin: 1rem;
  padding: 4rem 6rem 4rem 6rem;
  border-radius: 1rem;
  font-size: 2rem;
}
</style>