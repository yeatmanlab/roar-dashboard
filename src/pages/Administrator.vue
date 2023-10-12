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
          <!-- <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button> -->
        </template>

        <div v-if="initialized && !isLoadingAdministrations">
          <DataView :key="dataViewKey" :value="preprocessedAdministrations" lazy paginator :totalRecords="totalRecords"
            :rows="pageLimit" @page="onPage($event)" :dataKey="id">
            <template #list="slotProps">
              <div class="mt-2 w-full">
                <CardAdministration :id="slotProps.data.id" :title="slotProps.data.name" :stats="slotProps.data.stats"
                  :dates="slotProps.data.dates" :assignees="slotProps.data.assignedOrgs"
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
import { convertValues, mapFields } from "@/helpers/firestoreRest";
import { getSidebarActions } from "../router/sidebarActions";
import CardAdministration from "@/components/CardAdministration.vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";
import { useQuery } from '@tanstack/vue-query'
import axios from "axios"
import _mapValues from "lodash/mapValues";

const initialized = ref(false);
const page = ref(0);
const pageLimit = 3;
const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { roarfirekit } = storeToRefs(authStore);

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), false));

const userInfo = ref(
  {
    name: "Admin name",
    district: "District Name"
  }
)

const isSuperAdmin = computed(() => authStore.isUserSuperAdmin())

const userFetcher = () => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);
  const docPath = `/users/${roarfirekit.value.roarUid}`
  return axiosInstance.get(docPath).then(({ data }) => {
    return _mapValues(data.fields, (value) => convertValues(value));
  });
}

const userClaimsFetcher = () => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);
  const docPath = `/userClaims/${roarfirekit.value.roarUid}`
  return axiosInstance.get(docPath).then(({ data }) => {
    return _mapValues(data.fields, (value) => convertValues(value));
  });
}

const { isLoading: isLoadingUser, isFetching: isFetchingUser, data: userData } =
  useQuery({
    queryKey: ['user'],
    queryFn: () => userFetcher(),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims'],
    queryFn: () => userClaimsFetcher(),
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

const orderByDefault = [
  {
    field: { fieldPath: "name" },
    direction: "ASCENDING",
  }
];
const orderBy = ref(orderByDefault);

const getRequestBody = ({
  orderBy,
  aggregationQuery,
  paginate = true,
  skinnyQuery = false,
}) => {
  const requestBody = {
    structuredQuery: {
      orderBy: orderBy ?? orderByDefault,
    }
  };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page.value * pageLimit;
    }

    if (skinnyQuery) {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "id" },
          { fieldPath: "name" },
        ]
      };
    } else {
      requestBody.structuredQuery.select = {
        fields: [
          { fieldPath: "id" },
          { fieldPath: "name" },
          { fieldPath: "assessments" },
          { fieldPath: "dateClosed" },
          { fieldPath: "dateCreated" },
          { fieldPath: "dateOpened" },
          { fieldPath: "districts" },
          { fieldPath: "schools" },
          { fieldPath: "classes" },
          { fieldPath: "groups" },
          { fieldPath: "families" },
        ]
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: "administrations",
      allDescendants: false,
    }
  ];

  if (aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [{
          alias: "count",
          count: {},
        }]
      }
    }
  }

  return requestBody;
}

const countAdministrations = (orderBy) => {
  if (userClaims.value.claims.super_admin) {
    const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
    const axiosInstance = axios.create(axiosOptions);
    const requestBody = getRequestBody({
      aggregationQuery: true,
      orderBy: orderBy.value,
      paginate: false,
      skinnyQuery: true,
    });
    console.log(`Fetching count for administrations`, requestBody);
    return axiosInstance.post(":runAggregationQuery", requestBody).then(({ data }) => {
      console.log("count data", data)
      return Number(convertValues(data[0].result?.aggregateFields?.count));
    })
  }
}

const fetchAdministrations = (orderBy, page) => {
  if (userClaims.value.claims.super_admin) {
    const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
    const axiosInstance = axios.create(axiosOptions);
    const requestBody = getRequestBody({
      aggregationQuery: false,
      orderBy: orderBy.value,
      paginate: true,
      skinnyQuery: false,
    });
    console.log(`Fetching page ${page.value} for administrations`, requestBody);
    return axiosInstance.post(":runQuery", requestBody).then(({ data }) => {
      console.log("fetchAdministrations data", data)
      return mapFields(data)
    });
  }
}

const { isLoading: isLoadingCount, isFetching: isFetchingCount, data: totalRecords } =
  useQuery({
    queryKey: ['countAdministrations', orderBy],
    queryFn: () => countAdministrations(orderBy),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingAdministrations, isFetching: isFetchingAdministrations, data: administrations } =
  useQuery({
    queryKey: ['administrations', orderBy, page],
    queryFn: () => fetchAdministrations(orderBy, page),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const preprocessedAdministrations = computed(() => {
  return (administrations.value ?? []).map((a) => {
    const assignedOrgs = {
      districts: a.districts,
      schools: a.schools,
      classes: a.classes,
      groups: a.groups,
      families: a.families,
    }
    if (!userClaims.value.claims.super_admin) {
      assignedOrgs = filterAdminOrgs(userClaims.value.claims.adminOrgs, assignedOrgs);
    }
    return {
      id: a.id,
      name: a.name,
      stats: a.stats,
      dates: {
        start: a.dateOpened,
        end: a.dateClosed,
      },
      assessments: a.assessments,
      assignedOrgs,
    }
  })
});

const onPage = (event) => {
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

// const refresh = async () => {
//   unsubscribe();
//   refreshing.value = true;
//   await queryStore.getMyAdministrations();
//   refreshing.value = false;
// }

// const unsubscribe = authStore.$subscribe(async (mutation, state) => {
//   if (state.roarfirekit.getOrgs && state.roarfirekit.getMyAdministrations && state.roarfirekit.isAdmin()) {
//     await refresh();
//   }
// });

// onMounted(async () => {
//   if (roarfirekit.value.getOrgs && roarfirekit.value.getMyAdministrations && roarfirekit.value.isAdmin()) {
//     await refresh()
//   }
// })

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
