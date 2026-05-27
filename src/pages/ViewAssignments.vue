<template>
  <main class="container main">
    <section class="main-body">
      <div>
        <div class="flex flex-column">
          <div class="flex flex-row flex-wrap align-items-center justify-content-between mb-3 gap-3">
            <div class="flex flex-1 flex-column gap-2">
              <div class="page-title-row flex align-items-center justify-content-start gap-2 mb-2">
                <div class="admin-page-header m-0">View Assignments</div>
                <DocsButton
                  href="https://researcher.levante-network.org/dashboard/monitor-completion"
                  label="Documentation"
                />
              </div>

              <div class="text-md text-gray-500 mb-1 line-height-3">
                This page lists all the assignments that are administered to your users. You can view and monitor
                completion and create new bundles of tasks, surveys, and questionnaires to be administered as
                assignments.
              </div>
            </div>
            <div class="flex flex-1 justify-content-end align-items-center gap-2 mt-2">
              <div class="flex gap-3 align-items-stretch justify-content-start">
                <div class="flex flex-column gap-1">
                  <small id="search-help" class="text-gray-400">Search by name</small>
                  <div class="flex align-items-center">
                    <PvInputGroup>
                      <PvAutoComplete
                        v-model="searchInput"
                        placeholder="Search Assignments"
                        :suggestions="searchSuggestions"
                        data-cy="search-input"
                        @complete="autocomplete"
                        @keyup.enter="onSearch"
                      />
                      <PvButton
                        icon="pi pi-search"
                        class="text-xs bg-primary border-none text-white pl-3 pr-3"
                        @click="onSearch"
                      />
                    </PvInputGroup>
                  </div>
                </div>
              </div>

              <div class="flex flex-column gap-1">
                <label for="dd-sort" class="text-gray-400 text-xs">Sort by</label>
                <PvSelect
                  v-model="sortKey"
                  input-id="dd-sort"
                  :options="sortOptions"
                  option-label="label"
                  data-cy="dropdown-sort-administrations"
                  @change="onSortChange($event)"
                />
              </div>

              <div class="flex flex-column gap-1">
                <label for="dd-filter" class="text-gray-400 text-xs">Status</label>
                <PvSelect
                  v-model="filterKey"
                  input-id="dd-filter"
                  :options="filterOptions"
                  option-label="label"
                  data-cy="dropdown-filter-administrations"
                  @change="onFilterChange($event)"
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
          <div
            style="
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              margin-top: 100px;
              margin-bottom: 50px;
            "
          >
            <LevanteSpinner :size="200" />
          </div>
          <span class="uppercase font-light text-sm text-gray-600">
            <template v-if="fetchTestAdministrations">Fetching Test Assignments</template>
            <template v-else>Fetching Assignments</template>
          </span>
        </div>
        <div v-else>
          <PvBlockUI>
            <PvDataView
              :key="dataViewKey"
              v-model:first="dataViewFirst"
              :rows-per-page-options="[3, 5, 10, 25]"
              :rows="pageLimit"
              :sort-field="sortField"
              :sort-order="sortOrder"
              :total-records="filteredAdministrations?.length"
              :value="filteredAdministrations"
              data-key="id"
              paginator
              paginator-position="both"
            >
              <template v-if="filteredAdministrations?.length" #paginatorend>
                <span class="text-sm">
                  <span class="font-semibold">Total:</span> {{ filteredAdministrations?.length }}
                </span>
              </template>

              <template #list="slotProps">
                <div class="mb-2 w-full">
                  <CardAdministration
                    v-for="(item, cardIndexInPage) in slotProps.items"
                    :id="item.id"
                    :key="item.id"
                    :card-index-in-page="cardIndexInPage"
                    :current-page="currentPage"
                    :rows-per-page="pageLimit"
                    :title="getTitle(item, isUserSuperAdmin())"
                    :dates="item.dates"
                    :assignees="item.assignedOrgs"
                    :assessments="item.assessments"
                    :public-name="item.publicName ?? item.name"
                    :show-params="isUserSuperAdmin()"
                    :is-super-admin="isUserSuperAdmin()"
                    :creator-name="item.creatorName"
                    :sync-status="item.syncStatus"
                    data-cy="h2-card-admin"
                  />
                </div>
              </template>

              <template #empty>
                <div class="flex flex-column align-items-center justify-content-center py-8">
                  <h1 class="text-xl font-bold mb-4">No Assignments Yet</h1>
                  <p class="text-center text-gray-500 mb-4">Go create your first assignment to get started.</p>
                  <PvButton
                    label="Create Assignment"
                    class="bg-primary border-none text-white"
                    @click="$router.push({ name: 'CreateAssignment' })"
                  />
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
import PvAutoComplete from 'primevue/autocomplete';
import PvBlockUI from 'primevue/blockui';
import PvButton from 'primevue/button';
import PvDataView from 'primevue/dataview';
import PvSelect from 'primevue/select';
import PvInputGroup from 'primevue/inputgroup';
import { useAuthStore } from '@/store/auth';
import { orderByNameASC } from '@/helpers/query/utils';
import { getTitle } from '@/helpers/query/administrations';
import useAdministrationsListQuery from '@/composables/queries/useAdministrationsListQuery';
import CardAdministration from '@/components/CardAdministration.vue';
import DocsButton from '@/components/DocsButton.vue';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import { useLevanteStore } from '@/store/levante';
import { isCurrent, isPast, isUpcoming } from '@/helpers/assignments';

const initialized = ref(false);
const pageLimit = ref(10);
const page = ref(0);
const dataViewFirst = ref(0);
const currentPage = computed(() => (pageLimit.value > 0 ? Math.floor(dataViewFirst.value / pageLimit.value) + 1 : 1));

const orderBy = ref(orderByNameASC);
const searchSuggestions = ref([]);
const searchTokens = ref([]);
const searchInput = ref('');
const search = ref('');

const filteredAdministrations = ref([]);
const fetchTestAdministrations = ref(false);

const levanteStore = useLevanteStore();
const { assignmentsSelectedFilter, assignmentsSelectedSorting } = storeToRefs(levanteStore);
const { setAssignmentsSelectedFilter, setAssignmentsSelectedSorting } = levanteStore;
const authStore = useAuthStore();
const { currentSite, roarfirekit } = storeToRefs(authStore);
const { isUserSuperAdmin } = authStore;

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
  // Drop any one-shot router state (e.g. { status: 'open' } from the welcome page) so a refresh
  // or back/forward doesn't keep re-applying it on subsequent visits.
  history.replaceState({}, '');
});

/**
 * Generate search tokens for autocomplete.
 *
 * Using the administrations data, generates search tokens for the autocomplete search feature by splitting the
 * invididual administration names into separate tokens. For example, the administration "Partner Test Administration"
 * would be split into three tokens: "partner", "test", and "administration".
 *
 * @returns {void}
 */
const generateAutoCompleteSearchTokens = () => {
  if (!administrations.value?.length) return;

  // Set search tokens based on each administration's name.
  for (const item of administrations.value) {
    searchTokens.value.push(...item.name.toLowerCase().split(' '));
  }

  // Remove duplicates from array.
  searchTokens.value = [...new Set(searchTokens.value)];
};

const { isLoading: isLoadingAdministrations, data: administrations } = useAdministrationsListQuery(
  currentSite,
  orderBy,
  fetchTestAdministrations,
  {
    enabled: initialized,
    staleTime: 0,
    gcTime: 0,
  },
);

const filterOptions = ref([
  { label: 'All', value: null },
  { label: 'Open', value: 'open' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Closed', value: 'closed' },
]);

const getAssignmentsSelectedFilter = () => {
  // Honor a status filter passed via router state (e.g. "View open" on the welcome page) over any
  // previously-persisted filter so an explicit click always lands on the requested status.
  const statusFromRouterState = history.state?.status;
  if (typeof statusFromRouterState === 'string') {
    const optionFromRouterState = filterOptions.value.find((option) => option.value === statusFromRouterState);
    if (optionFromRouterState) {
      setAssignmentsSelectedFilter(optionFromRouterState);
      return optionFromRouterState;
    }
  }

  if (assignmentsSelectedFilter.value) return assignmentsSelectedFilter.value;

  const defaultLabel = 'All';
  const defaultOption = filterOptions.value.find((option) => option.label === defaultLabel) || filterOptions.value[0];

  setAssignmentsSelectedFilter(defaultOption);

  return defaultOption;
};

const filterKey = ref(getAssignmentsSelectedFilter());

// Table sort options
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
        field: { fieldPath: 'dates.start' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'Start date (descending)',
    value: [
      {
        field: { fieldPath: 'dates.start' },
        direction: 'DESCENDING',
      },
    ],
  },
  {
    label: 'End date (ascending)',
    value: [
      {
        field: { fieldPath: 'dates.end' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'End date (descending)',
    value: [
      {
        field: { fieldPath: 'dates.end' },
        direction: 'DESCENDING',
      },
    ],
  },
  {
    label: 'Creation date (ascending)',
    value: [
      {
        field: { fieldPath: 'dates.created' },
        direction: 'ASCENDING',
      },
    ],
  },
  {
    label: 'Creation date (descending)',
    value: [
      {
        field: { fieldPath: 'dates.created' },
        direction: 'DESCENDING',
      },
    ],
  },
]);

const getAssignmentsSelectedSorting = () => {
  if (assignmentsSelectedSorting.value) return assignmentsSelectedSorting.value;

  const defaultLabel = 'Start date (descending)';
  const defaultOption = sortOptions.value.find((option) => option.label === defaultLabel) || sortOptions.value[0];

  setAssignmentsSelectedSorting(defaultOption);

  return defaultOption;
};

const sortKey = ref(getAssignmentsSelectedSorting());
const sortOrder = ref();
const sortField = ref();
const dataViewKey = ref(0);

/**
 * Clear the search input and reset the filtered administrations list.
 * @returns {void}
 */
const clearSearch = () => {
  search.value = '';
  searchInput.value = '';
  filteredAdministrations.value = administrations.value;
};

/**
 * Perform a search based on the search input value.
 * @returns {void}
 */
const onSearch = () => {
  search.value = searchInput.value;
  if (!search.value) filteredAdministrations.value = administrations.value;
  else {
    filteredAdministrations.value = administrations.value.filter((item) =>
      item.name.toLowerCase().includes(search.value.toLowerCase()),
    );
  }
};

/**
 * Perform an autocomplete search based on the search input value.
 * @returns {void}
 */
const autocomplete = () => {
  searchSuggestions.value = searchTokens.value.filter((item) => {
    return item.toLowerCase().includes(searchInput.value.toLowerCase());
  });
};

const onFilterChange = (event) => {
  dataViewKey.value += 1;
  page.value = 0;
  dataViewFirst.value = 0;
  const filterValue = event.value;

  filteredAdministrations.value = administrations.value?.filter((assignment) => {
    switch (filterValue.value) {
      case 'open':
        return isCurrent(assignment);
      case 'upcoming':
        return isUpcoming(assignment);
      case 'closed':
        return isPast(assignment);
      default:
        return true;
    }
  });

  setAssignmentsSelectedFilter(filterValue);
};

/**
 * Sort change event handler
 * @param {*} event – The sort event object emitted by PrimeVue
 * @returns {void}
 */
const onSortChange = (event) => {
  dataViewKey.value += 1;
  page.value = 0;
  dataViewFirst.value = 0;
  const value = event.value.value;
  const sortValue = event.value;

  sortField.value = value[0].field?.fieldPath;
  sortOrder.value = value[0].direction === 'DESCENDING' ? -1 : 1;
  sortKey.value = sortValue;

  setAssignmentsSelectedSorting(sortValue);
};

/**
 * Administration data watcher
 *
 * Watches the administrations data, and once data is available, generates search tokens and sets the filtered
 * administrations based on the search value.
 *
 * @returns {void}
 */
watch(
  administrations,
  (updatedAdministrationsData) => {
    if (!updatedAdministrationsData) return;

    // Generate auto-complete search tokens based on the data.
    generateAutoCompleteSearchTokens();

    // Set the filtered administrations based on the search value.
    if (!search.value) {
      filteredAdministrations.value = updatedAdministrationsData;
    } else {
      filteredAdministrations.value = updatedAdministrationsData?.filter((item) =>
        item.name.toLowerCase().includes(search.value.toLowerCase()),
      );
    }

    onFilterChange({ value: filterKey.value });
    onSortChange({ value: sortKey.value });
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.page-title-row :deep(.docs-button) {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

.how-to-section {
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 2rem 0;

  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--primary-color);
    font-size: 1.2rem;
    font-weight: bold;
  }
}
</style>

<style lang="scss">
.p-autocomplete-panel {
  background: var(--surface-a);
  color: var(--text-color);
  border: 0 none;
  border-radius: var(--border-radius);
  box-shadow:
    0 0 rgba(0, 0, 0, 0),
    0 0 rgba(0, 0, 0, 0),
    0 10px 15px -3px rgba(0, 0, 0, 0.1019607843),
    0 4px 6px -2px rgba(0, 0, 0, 0.0509803922);
}

.p-autocomplete-panel .p-autocomplete-items .p-autocomplete-item {
  margin: 0;
  padding: var(--inline-spacing-larger) 1rem;
  border: 0 none;
  color: var(--text-color);
  background: transparent;
  transition: none;
  border-radius: 0;
}

.p-autocomplete-panel .p-autocomplete-items .p-autocomplete-item:hover {
  background-color: gainsboro;
}

button.p-button.p-component.p-button-icon-only.p-autocomplete-dropdown {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 20%;
  width: 3rem;
}

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
