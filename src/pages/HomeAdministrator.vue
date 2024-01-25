<template>
  <main class="container main">
    <section class="main-body">
      <PvPanel header="Your administrations">
        <template #icons>
          <label class="mr-2" for="dd-sort">Sort by</label>
          <PvDropdown
            v-model="sortKey"
            input-id="dd-sort"
            :options="sortOptions"
            option-label="label"
            @change="onSortChange($event)"
          />
        </template>

        <div v-if="initialized && !isLoadingAdministrations">
          <PvBlockUI :blocked="isFetchingAdministrations">
            <PvDataView
              :key="dataViewKey"
              :value="administrations"
              lazy
              paginator
              paginator-position="both"
              :total-records="totalRecords"
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
                    :title="item.name"
                    :stats="item.stats"
                    :dates="item.dates"
                    :assignees="item.assignedOrgs"
                    :assessments="item.assessments"
                    :show-params="isSuperAdmin"
                    :is-super-admin="isSuperAdmin"
                  />
                </div>
              </template>
              <template #empty>
                <div>
                  There are no administrations to display. Please contact a lab administrator to add you as an admin to
                  an administration.
                </div>
              </template>
            </PvDataView>
          </PvBlockUI>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span>Loading Administrations</span>
        </div>
      </PvPanel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { orderByDefault, fetchDocById } from '@/helpers/query/utils';
import { administrationCounter, administrationPageFetcher } from '../helpers/query/administrations';
import CardAdministration from '@/components/CardAdministration.vue';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';

const initialized = ref(false);
const page = ref(0);
const pageLimit = ref(10);

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
  queryKey: ['administrations', orderBy, page, pageLimit, isSuperAdmin, administrationQueryKeyIndex],
  queryFn: () => administrationPageFetcher(orderBy, pageLimit, page, isSuperAdmin, adminOrgs, exhaustiveAdminOrgs),
  keepPreviousData: true,
  enabled: canQueryAdministrations,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

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
