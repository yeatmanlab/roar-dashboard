<template>
  <div style="display: flex; flex-direction: row">
    <router-link
      :to="cardData.buttonLink"
      v-for="(cardData, index) in cardsData"
      :key="index" class="card-wrapper">
      <Card style="width: 25em" class="card-title">
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
  
  <CardAdministration 
    :id="admin.id"
    :title="admin.title" 
    :stats="admin.stats" 
    :dates="admin.dates"
    :assignees="admin.assignees"
    :assessments="admin.assessments"
    ></CardAdministration>
  
</template>

<script setup>
  import { ref } from "vue";
  import CardAdministration from "@/components/CardAdministration.vue";

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
      title: "Create an administration",
      content: "Text here about the actions this provides",
      buttonText: "Go",
      buttonLink: "/create-admin",
    }
  ]);
  
  const admin = ref(
      {
         id: 234,
         title: 'Administration Title',
         stats: {'total':100, 'started': 54, 'completed': 26},
         dates: {'start': 12345, 'end': 123456},
         assignees: ['Class1', 'Class2'],
         assessments: ['SRE', 'PWA', 'SWA']
       }
    
  );


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
