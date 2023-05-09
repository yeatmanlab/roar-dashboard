<template>
  <div class="card">
    <Accordion class="accordion-custom">
      <AccordionTab v-for="game in games" :key="game.id">
        <template #header>
          <i v-if="game.completed" class="pi pi-check-circle mr-2" />
          <i v-else class="pi pi-circle mr-2" />
          {{ game.title }}
        </template>
        {{ game.description }}
      </AccordionTab>
    </Accordion>
  </div>
</template>
<script setup>
const props = defineProps({
  games: {required: true, default: {}}
})
</script>
<style scoped>
.p-accordion {
  margin: 2rem;
}
.p-accordion-header {
  background-color: red;
}
</style>