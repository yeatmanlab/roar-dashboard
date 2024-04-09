<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <div class="flex align-items-center justify-content-between">
          <div class="flex-column flex-wrap gap-2">
            <div class="text-3xl font-bold text-gray-600">Your Administrations</div>
          </div>
          <div class="flex gap-3 align-items-center justify-content-around p-3">
            <div class="flex flex-column gap-1">
              <small id="search-help" class="text-gray-500">Search by administration name</small>
              <div class="flex">
                <PvInputText id="search" v-model="search" placeholder="Search Administrations" />
                <PvButton icon="pi pi-search" text @click="onSearch" />
              </div>
            </div>
            <div class="flex flex-column gap-1">
              <small for="dd-sort" class="text-gray-500">Sort by</small>
              <PvDropdown
                v-model="sortKey"
                input-id="dd-sort"
                :options="sortOptions"
                option-label="label"
                data-cy="dropdown-sort-administrations"
                @change="onSortChange($event)"
              />
            </div>
          </div>
        </div>
        <div v-if="initialized && !isLoadingAdministrations">
          <PvBlockUI :blocked="isFetchingAdministrations">
            <PvDataView
              :key="dataViewKey"
              :value="filteredAdministrations"
              lazy
              paginator
              paginator-position="both"
              :total-records="filteredAdministrations.length"
              :rows="pageLimit"
              :rows-per-page-options="[3, 5, 10, 25]"
              data-key="id"
              @page="onPage($event)"
            >
              <template #list="slotProps">
                <div class="mb-2 w-full">
                  <CardAdministration
                    v-for="item in slotProps.items"
                    :id="item.id"
                    :key="item.id"
                    :title="getTitle(item, isSuperAdmin)"
                    :stats="item.stats"
                    :dates="item.dates"
                    :assignees="item.assignedOrgs"
                    :assessments="item.assessments"
                    :show-params="isSuperAdmin"
                    :is-super-admin="isSuperAdmin"
                    data-cy="h2-card-admin-title"
                  />
                </div>
              </template>
              <template #empty>
                <div>
                  {{
                    isLevante
                      ? 'There are no administrations to display. You can create an administration by navigating to the' +
                        'Create administration page from the dropdown menu.'
                      : 'There are no administrations to display. Please contact a lab administrator to add you as an admin' +
                        ' to an administration.'
                  }}
                </div>
              </template>
            </PvDataView>
          </PvBlockUI>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span>Loading Administrations</span>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted, reactive } from 'vue';
import { storeToRefs } from 'pinia';
import { orderByDefault, fetchDocById } from '@/helpers/query/utils';
import { administrationCounter, administrationPageFetcher, getTitle } from '../helpers/query/administrations';
import CardAdministration from '@/components/CardAdministration.vue';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';

const initialized = ref(false);
const page = ref(0);
const search = ref('');
const pageLimit = ref(10);
const isLevante = import.meta.env.MODE === 'LEVANTE';

const authStore = useAuthStore();

const { roarfirekit, administrationQueryKeyIndex } = storeToRefs(authStore);

const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
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
};

unsubscribeInitializer = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);
const exhaustiveAdminOrgs = computed(() => userClaims.value?.claims?.adminOrgs);
const orderBy = ref(orderByDefault);
const canQueryAdministrations = computed(() => {
  return initialized.value && !isLoadingClaims.value;
});

const { data: totalRecords } = useQuery({
  queryKey: ['countAdministrations', orderBy, isSuperAdmin, administrationQueryKeyIndex],
  queryFn: () => administrationCounter(orderBy, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: canQueryAdministrations,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const {
  isLoading: isLoadingAdministrations,
  isFetching: isFetchingAdministrations,
  data: administrations,
} = useQuery({
  queryKey: ['administrations', orderBy, page, 10000, isSuperAdmin, administrationQueryKeyIndex],
  queryFn: () => administrationPageFetcher(orderBy, 10000, page, isSuperAdmin, adminOrgs, exhaustiveAdminOrgs),
  keepPreviousData: true,
  enabled: canQueryAdministrations,
  staleTime: 5 * 60 * 1000, // 5 minutes
  onSuccess: (data) => {
    filteredAdministrations.value = data;
  },
});

const filteredAdministrations = ref([]);

const onSearch = () => {
  console.log(administrations.value);
  if (!search.value) filteredAdministrations.value = administrations.value;
  else {
    const searchedAdministrations = administrations.value.filter((item) =>
      item.name.toLowerCase().includes(search.value.toLowerCase()),
    );
    console.log('filteredAdministrations', searchedAdministrations, search.value);
    filteredAdministrations.value = searchedAdministrations;
  }
};

const onPage = (event) => {
  pageLimit.value = event.rows;
  page.value = event.page;
};

const sortOptions = ref([
  {
    label: 'Name (ascending)',
    value: [
      {
        field: { fieldPath: 'name' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'Name (descending)',
    value: [
      {
        field: { fieldPath: 'name' },
        direction: 'DESCENDING',
      },
    ],
  },
  {
    label: 'Start date (ascending)',
    value: [
      {
        field: { fieldPath: 'dateOpened' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'Start date (descending)',
    value: [
      {
        field: { fieldPath: 'dateOpened' },
        direction: 'DESCENDING',
      },
    ],
  },
  {
    label: 'End date (ascending)',
    value: [
      {
        field: { fieldPath: 'dateClosed' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'End date (descending)',
    value: [
      {
        field: { fieldPath: 'dateClosed' },
        direction: 'DESCENDING',
      },
    ],
  },
  {
    label: 'Creation date (ascending)',
    value: [
      {
        field: { fieldPath: 'dateCreated' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'Creation date (descending)',
    value: [
      {
        field: { fieldPath: 'dateCreated' },
        direction: 'DESCENDING',
      },
    ],
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
