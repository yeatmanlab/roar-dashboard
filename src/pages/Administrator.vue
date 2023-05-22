<template>
  <div style="display: flex; flex-direction: row">
    <router-link
      :to="cardData.buttonLink"
      v-for="(cardData, index) in cardsData"
      :key="index" class="card-wrapper">
      <Card style="width: 25em">
        <template #title>
          <div class="card-title">
            {{ cardData.title }}
          </div>
        </template>
        <template #content>
          {{ cardData.content }}
        </template>
        <template #footer>
          <div class="card-button">
            <Button :label="cardData.buttonText" />
          </div>
        </template>
      </Card>
    </router-link>
  </div>
  
</template>

<script setup>
  import { ref } from "vue";

  const cardsData = ref([
    {
      title: "Display students",
      content: "Text here about the actions this provides",
      buttonText: "Go",
      buttonLink: "/list-students",
    },
    {
      title: "Query your administrations",
      content: "Text here about the actions this provides",
      buttonText: "Go",
      buttonLink: "/query-admin",
    },
    {
      title: "Start an administration",
      content: "Text here about the actions this provides",
      buttonText: "Go",
      buttonLink: "/start-admin",
    }
  ]);
</script>

<style scoped>
.card-wrapper {
  margin-bottom: 1rem;
  margin-right: 1rem;
  text-decoration: none;
  color: inherit;
}

.card-title {
  text-align: left;
}

.card-button {
  display: flex;
  justify-content: flex-end;
}
</style>
