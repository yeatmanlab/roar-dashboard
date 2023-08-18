<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :userInfo="userInfo" />
    </aside>

    <section class="main-body">
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

      <div v-if="administrations.length" v-for="(a, index) in administrations" :key="index">
        <CardAdministration :id="a.id" :title="a.name" :stats="a.stats" :dates="a.dates" :assignees="a.assignedOrgs"
          :assessments="a.assessments"></CardAdministration>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { storeToRefs } from "pinia";
import CardAdministration from "@/components/CardAdministration.vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { administrations } = storeToRefs(queryStore);

const cardsData = ref([
  {
    title: "Create an organization",
    content: "Create a new district, school, class, or group.",
    buttonText: "Go",
    buttonLink: "/create-orgs",
  },
  {
    title: "List organizations",
    content: "List all organizations that you have access to.",
    buttonText: "Go",
    buttonLink: "/list-orgs",
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

const userInfo = ref(
  {
    name: "Admin name",
    district: "District Name"
  }
)

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

const getAdminDocs = async () => {
  unsubscribe();
  queryStore.getAdminOrgs();
  queryStore.getMyAdministrations();
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getOrgs && state.roarfirekit.getMyAdministrations && state.roarfirekit.isAdmin()) {
    await getAdminDocs();
  }
});
</script>

<style scoped>
.card-container {
  display: flex;
  flex-direction: row;
  margin: 0 0 2rem;
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

.loading-container {
  width: 100%;
  text-align: center;
}
</style>
