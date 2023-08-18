<template>
  <div style="display: flex">
    <div class="card-container">
      <router-link :to="cardData.buttonLink" v-for="(cardData, index) in cardsData" :key="index" class="card-wrapper">
        <Card class="card-title">
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
  </div>

  <CardAdministration :id="admin.id" :title="admin.title" :stats="admin.stats" :dates="admin.dates"
    :assignees="admin.assignees" :assessments="admin.assessments"></CardAdministration>
</template>

<script setup>
import { ref } from "vue";
import CardAdministration from "@/components/CardAdministration.vue";

const cardsData = ref([
  {
    title: "Create an organization",
    content: "Create a new district, school, class, or study.",
    buttonText: "Go",
    buttonLink: "/create-org",
  },
  {
    title: "Register users",
    content: "Create new student account by uploading a CSV file.",
    buttonText: "Go",
    buttonLink: "/mass-upload",
  },
  {
    title: "Create an administration",
    content: "Create a new ROAR administration and assign it to organizations.",
    buttonText: "Go",
    buttonLink: "/create-admin",
  }
]);

const admin = ref(
  {
    id: 234,
    title: 'Administration Title',
    stats: { 'total': 100, 'started': 54, 'completed': 26 },
    dates: { 'start': 12345, 'end': 123456 },
    assignees: ['Class1', 'Class2'],
    assessments: ['SRE', 'PWA', 'SWA']
  }

);


</script>

<style scoped>
.card-container {
  display: flex;
  flex-direction: row;
  margin: 2rem 1rem 2rem 1rem;
  flex: 1;
  gap: 1rem;
}
.card-wrapper {
  /* margin-right: 1rem; */
  width: 100%;
  text-decoration: none;
  color: inherit;
}

.card-title {
  text-align: left;
  height: 100%;
}

.card-button {
  display: flex;
  justify-content: flex-end;
}
</style>
