<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :userInfo="userInfo" :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Your administrations">
        <template #icons>
          <label class="mr-2" for="dd-sort">Sort by</label>
          <Dropdown v-model="sortKey" inputId="dd-sort" :options="sortOptions" optionLabel="label"
            @change="onSortChange($event)" />
        </template>

        <div v-if="initialized && !isLoadingAdministrations">
          <DataView :key="dataViewKey" :value="administrations" lazy paginator paginatorPosition="top"
            :totalRecords="totalRecords" :rows="pageLimit" :rowsPerPageOptions="[3, 5, 10, 25]" @page="onPage($event)"
            dataKey="id">
            <template #list="slotProps">
              <div class="mb-2 w-full">
                <CardAdministration :key="slotProps.data.id" :id="slotProps.data.id" :title="slotProps.data.name"
                  :stats="slotProps.data.stats" :dates="slotProps.data.dates" :assignees="slotProps.data.assignedOrgs"
                  :assessments="slotProps.data.assessments" />
              </div>
            </template>
            <template #empty>
              <div>
                There are no administrations to display. Please contact a lab
                administrator to add you as an admin to an administration.
              </div>
            </template>
          </DataView>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span>Loading Administrations</span>
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import {
  orderByDefault,
  fetchDocById,
} from "@/helpers/query/utils";
import { administrationCounter, administrationPageFetcher } from "../helpers/query/administrations";
import { getSidebarActions } from "../router/sidebarActions";
import CardAdministration from "@/components/CardAdministration.vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { useAuthStore } from "@/store/auth";
import { useQuery } from '@tanstack/vue-query'
import _mapValues from "lodash/mapValues";
import _zip from "lodash/zip";

const initialized = ref(false);
const page = ref(0);
const pageLimit = ref(3);
const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), false));

const userInfo = ref(
  {
    name: "Admin name",
    district: "District Name"
  }
)

const { isLoading: isLoadingUser, isFetching: isFetchingUser, data: userData } =
  useQuery({
    queryKey: ['user', authStore.uid, authStore.userQueryKeyIndex],
    queryFn: () => fetchDocById('users', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims', authStore.uid, authStore.userClaimsQueryKeyIndex],
    queryFn: () => fetchDocById('userClaims', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

let unsubscribeInitializer;
const init = () => {
  if (unsubscribeInitializer) unsubscribeInitializer();
  initialized.value = true;
}

unsubscribeInitializer = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
})

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);
const exhaustiveAdminOrgs = computed(() => userClaims.value?.claims?.adminOrgs);
const orderBy = ref(orderByDefault);
const canQueryAdministrations = computed(() => {
  return initialized.value && !isLoadingClaims.value;
});

const { isLoading: isLoadingCount, isFetching: isFetchingCount, data: totalRecords } =
  useQuery({
    queryKey: ['countAdministrations', orderBy, isSuperAdmin],
    queryFn: () => administrationCounter(orderBy, isSuperAdmin, adminOrgs),
    keepPreviousData: true,
    enabled: canQueryAdministrations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingAdministrations, isFetching: isFetchingAdministrations, data: administrations } =
  useQuery({
    queryKey: ['administrations', orderBy, page, pageLimit, isSuperAdmin],
    queryFn: () => administrationPageFetcher(orderBy, pageLimit, page, isSuperAdmin, adminOrgs, exhaustiveAdminOrgs),
    keepPreviousData: true,
    enabled: canQueryAdministrations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const onPage = (event) => {
  pageLimit.value = event.rows;
  page.value = event.page;
}

const sortOptions = ref([
  {
    label: 'Name (ascending)',
    value: [{
      field: { fieldPath: "name" },
      direction: "ASCENDING",
    }]
  },
  {
    label: 'Name (descending)',
    value: [{
      field: { fieldPath: "name" },
      direction: "DESCENDING",
    }]
  },
  {
    label: 'Start date (ascending)',
    value: [{
      field: { fieldPath: "dateOpened" },
      direction: "ASCENDING",
    }]
  },
  {
    label: 'Start date (descending)',
    value: [{
      field: { fieldPath: "dateOpened" },
      direction: "DESCENDING",
    }]
  },
  {
    label: 'End date (ascending)',
    value: [{
      field: { fieldPath: "dateClosed" },
      direction: "ASCENDING",
    }]
  },
  {
    label: 'End date (descending)',
    value: [{
      field: { fieldPath: "dateClosed" },
      direction: "DESCENDING",
    }]
  },
  {
    label: 'Creation date (ascending)',
    value: [{
      field: { fieldPath: "dateCreated" },
      direction: "ASCENDING",
    }]
  },
  {
    label: 'Creation date (descending)',
    value: [{
      field: { fieldPath: "dateCreated" },
      direction: "DESCENDING",
    }]
  },
]);
const sortKey = ref(sortOptions.value[0]);

const dataViewKey = ref(0);

const onSortChange = (event) => {
  dataViewKey.value += 1;
  page.value = 0;
  orderBy.value = event.value.value;
};

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
