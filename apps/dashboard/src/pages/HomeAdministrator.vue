<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <div class="flex flex-column">
          <div class="flex flex-row flex-wrap align-items-center justify-content-between mb-3 gap-3">
            <div class="flex flex-column gap-2">
              <div class="flex align-items-center flex-wrap gap-3 mb-2">
                <i class="pi pi-list text-gray-400 rounded" style="font-size: 1.6rem" />
                <div class="admin-page-header">View Administrations</div>
              </div>
              <div class="text-md text-gray-500 ml-6">Lists administrations assigned to your account</div>
            </div>

            <div class="flex align-items-center gap-2">
              <div class="flex gap-3 align-items-stretch justify-content-start">
                <div class="flex flex-column gap-1">
                  <small id="search-help" class="text-gray-400">Search by administration name</small>
                  <div class="flex align-items-center">
                    <PvInputGroup>
                      <PvInputText
                        v-model="searchInput"
                        placeholder="Search Administrations"
                        data-cy="search-input"
                        aria-describedby="search-help"
                      />
                      <PvButton
                        v-if="search.length > 0"
                        icon="pi pi-times"
                        class="text-xs bg-primary border-none text-white pl-3 pr-3"
                        aria-label="Clear search"
                        @click="clearSearch"
                      />
                    </PvInputGroup>
                  </div>
                </div>
              </div>

              <div class="flex flex-column gap-1">
                <small for="dd-sort" class="text-gray-400">Sort by</small>
                <PvSelect
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

          <div
            v-if="search.length > 0"
            class="flex align-items-center gap-3 text-gray-700 px-4 py-3 my-1 bg-gray-100 rounded"
          >
            <div>
              You searched for <strong>{{ search }}</strong>
            </div>
            <PvButton
              text
              class="text-xs p-2 border-none border-round text-primary hover:surface-200"
              @click="clearSearch"
            >
              Clear Search
            </PvButton>
          </div>
        </div>

        <div v-if="!initialized || isLoadingAdministrations" class="loading-container">
          <AppSpinner class="mb-4" />
          <span class="uppercase font-light text-sm text-gray-600">Fetching Administrations</span>
        </div>
        <div v-else>
          <PvBlockUI :blocked="isFetchingAdministrations">
            <PvDataView
              :value="administrationItems"
              lazy
              paginator
              paginator-position="both"
              :total-records="totalRecords"
              :rows="rows"
              :first="first"
              :rows-per-page-options="[3, 5, 10, 25]"
              data-key="id"
              @page="onPage($event)"
            >
              <template #list="slotProps">
                <div class="mb-2 w-full" data-cy="administrations-list">
                  <CardAdministration
                    v-for="item in slotProps.items"
                    :id="item.id"
                    :key="item.id"
                    :title="getTitle(item, isSuperAdmin)"
                    :stats="item.stats"
                    :dates="item.dates"
                    :assessments="item.assessments"
                    :public-name="item.publicName ?? item.name"
                    :is-super-admin="isSuperAdmin"
                  />
                </div>
              </template>
              <template #empty>
                <div>
                  {{
                    search.length > 0
                      ? `No administrations match "${search}".`
                      : 'There are no administrations to display. Please contact a lab administrator to add you as an admin to an administration.'
                  }}
                </div>
              </template>
            </PvDataView>
          </PvBlockUI>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import PvBlockUI from 'primevue/blockui';
import PvButton from 'primevue/button';
import PvDataView from 'primevue/dataview';
import PvSelect from 'primevue/select';
import PvInputGroup from 'primevue/inputgroup';
import PvInputText from 'primevue/inputtext';
import { useAuthStore } from '@/store/auth';
import { getTitle } from '@/helpers/query/administrations';
import { isEmulatorAuthReady } from '@/helpers/isDashboardReady';
import _debounce from 'lodash/debounce';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useAdministrationsListQuery from '@/composables/queries/useAdministrationsListQuery';
import CardAdministration from '@/components/CardAdministration.vue';

const SEARCH_DEBOUNCE_MS = 300;

const initialized = ref(false);

// Server-driven pagination state. `first` is the 0-indexed row offset PrimeVue's
// DataView tracks; `rows` is the page size; `page` is the 1-indexed page the backend
// expects, derived from first/rows.
const rows = ref(10);
const first = ref(0);
const page = computed(() => Math.floor(first.value / rows.value) + 1);

// Server-driven sort. Defaults mirror the previous default view (name ascending).
const sortBy = ref('name');
const sortOrder = ref('asc');

// Server-driven search. `searchInput` is the live input value; `search` is its
// debounced projection fed to the query so we don't refetch on every keystroke.
const searchInput = ref('');
const search = ref('');
// Project the live input into `search` on a trailing debounce: the input stays
// instant (bound to `searchInput`) while the query — which keys on `search` — only
// refetches once the user pauses typing.
const applySearch = _debounce((value) => {
  search.value = value;
}, SEARCH_DEBOUNCE_MS);
watch(searchInput, (value) => applySearch(value));

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

let unsubscribeInitializer;
const init = () => {
  if (unsubscribeInitializer) unsubscribeInitializer();
  initialized.value = true;
};

unsubscribeInitializer = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.() || isEmulatorAuthReady(state)) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig?.() || isEmulatorAuthReady(authStore)) init();
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);

const {
  isLoading: isLoadingAdministrations,
  isFetching: isFetchingAdministrations,
  data: administrations,
} = useAdministrationsListQuery(page, rows, sortBy, sortOrder, search, {
  enabled: initialized,
});

// The query resolves to `{ items, pagination }`; expose the current page's rows and
// the server's total so the lazy DataView can render and size its paginator.
const administrationItems = computed(() => administrations.value?.items ?? []);
const totalRecords = computed(() => administrations.value?.pagination?.totalItems ?? 0);

// Sort dropdown options. Each maps to a server sort field (name|dateStart|dateEnd)
// and direction (asc|desc). The backend sorts administrations by `name`; the previous
// client-side "sort partner admins by publicName" hack is dropped — see the PR notes.
const sortOptions = ref([
  { label: 'Name (ascending)', value: { sortBy: 'name', sortOrder: 'asc' } },
  { label: 'Name (descending)', value: { sortBy: 'name', sortOrder: 'desc' } },
  { label: 'Start date (ascending)', value: { sortBy: 'dateStart', sortOrder: 'asc' } },
  { label: 'Start date (descending)', value: { sortBy: 'dateStart', sortOrder: 'desc' } },
  { label: 'End date (ascending)', value: { sortBy: 'dateEnd', sortOrder: 'asc' } },
  { label: 'End date (descending)', value: { sortBy: 'dateEnd', sortOrder: 'desc' } },
]);
const sortKey = ref(sortOptions.value[0]);

/**
 * Reset to the first page. Called whenever the result set changes shape (new sort or
 * search) so the user isn't stranded on a now-out-of-range page.
 * @returns {void}
 */
const resetToFirstPage = () => {
  first.value = 0;
};

// A new (debounced) search term changes the result set, so jump back to the first page.
// Watching the debounced ref means we reset once per settled term, not per keystroke.
watch(search, resetToFirstPage);

/**
 * Clear the search term immediately. Cancels any pending debounced update and resets
 * both the live input and the query-facing `search` ref so the unfiltered list loads
 * at once; the `watch(search, …)` above then resets the page.
 * @returns {void}
 */
const clearSearch = () => {
  applySearch.cancel();
  searchInput.value = '';
  search.value = '';
};

/**
 * DataView lazy page handler. PrimeVue emits `{ first, rows }` on page/rows change;
 * mirror them into our state so the query refetches the requested server page.
 * @param {{ first: number, rows: number }} event – PrimeVue page event.
 * @returns {void}
 */
const onPage = (event) => {
  first.value = event.first;
  rows.value = event.rows;
};

/**
 * Sort change handler. Maps the selected option to server sort field + direction and
 * resets to the first page so the re-sorted list starts at the top.
 * @param {{ value: { value: { sortBy: string, sortOrder: string } } }} event – PrimeVue select change event.
 * @returns {void}
 */
const onSortChange = (event) => {
  const { sortBy: nextSortBy, sortOrder: nextSortOrder } = event.value.value;
  sortBy.value = nextSortBy;
  sortOrder.value = nextSortOrder;
  resetToFirstPage();
};
</script>

<style>
.card-container {
  display: flex;
  flex-direction: row;
  margin: 0 0 2rem;
  flex: 1;
  gap: 1rem;
}

.card-wrapper {
  width: 100%;
  text-decoration: none;
  color: inherit;
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
