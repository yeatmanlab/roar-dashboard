<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :userInfo="userInfo" :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Your administrations">
        <template #icons v-if="isSuperAdmin">
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        <div v-if="isSuperAdmin">
          <div v-if="administrationsReady">
            <div v-if="administrations.length" v-for="(a, index) in administrations" :key="index">
              <CardAdministration :id="a.id" :title="a.name" :stats="a.stats" :dates="a.dates" :assignees="a.assignedOrgs"
                :assessments="a.assessments"></CardAdministration>
            </div>
            <div v-else>There are no administrations to display. Please contact a lab administrator to add you as an admin
              to an administration.</div>
          </div>
          <div v-else class="loading-container">
            <AppSpinner style="margin-bottom: 1rem;" />
            <span>Loading Administrations</span>
          </div>
        </div>
        <div v-else>
          The Administrator View is currently under construction!
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import CardAdministration from "@/components/CardAdministration.vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";
import { getSidebarActions } from "../router/sidebarActions";

const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { roarfirekit } = storeToRefs(authStore);
const { administrations } = storeToRefs(queryStore);
const administrationsReady = ref(administrations.value.length);

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), false));

const userInfo = ref(
  {
    name: "Admin name",
    district: "District Name"
  }
)

const isSuperAdmin = computed(() => authStore.isUserSuperAdmin())

const refresh = async () => {
  unsubscribe();
  refreshing.value = true;
  const orgsPromise = queryStore.getAdminOrgs();
  const adminsitrationsPromise = queryStore.getMyAdministrations();
  await Promise.all([orgsPromise, adminsitrationsPromise]).then(() => {
    administrationsReady.value = true;
    refreshing.value = false;
  });
}

const unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getOrgs && state.roarfirekit.getMyAdministrations && state.roarfirekit.isAdmin()) {
    await refresh();
  }
});

onMounted(async () => {
  if (roarfirekit.value.getOrgs && roarfirekit.value.getMyAdministrations) {
    await refresh()
  }
})

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
