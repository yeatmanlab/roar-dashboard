<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :userInfo="userInfo" :actions="sidebarActions" />
    </aside>

    <section class="main-body">
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

const sidebarActions = ref([
  {
    title: "Register users",
    content: "Create new student account by uploading a CSV file.",
    buttonText: "Go",
    buttonLink: "/register-users",
  },
  {
    title: "Create an organization",
    icon: "pi pi-database",
    buttonLink: "/create-orgs",
  },
  {
    title: "Create an administration",
    icon: "",
    buttonLink: "/create-admin",
  },
  {
    title: "List organizations",
    icon: "",
    buttonLink: "/list-orgs",
  },
]);

const userInfo = ref(
  {
    name: "Admin name",
    district: "District Name"
  }
)

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
