<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Your organizations">
        <template #icons>
          <button v-if="isSuperAdmin" v-tooltip.top="'Sync Clever orgs'" class="p-panel-header-icon mr-2"
            @click="syncClever">
            <span :class="cleverSyncIcon"></span>
          </button>
        </template>
        <TabView v-if="claimsLoaded" lazy v-model:activeIndex="activeIndex">
          <TabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
            <div class="grid column-gap-3 mt-2">
              <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3"
                v-if="activeOrgType === 'schools' || activeOrgType === 'classes'">
                <span class="p-float-label">
                  <Dropdown v-model="selectedDistrict" inputId="district" :options="allDistricts" optionLabel="name"
                    optionValue="id" :placeholder="districtPlaceholder" :loading="isLoadingDistricts" class="w-full" />
                  <label for="district">District</label>
                </span>
              </div>
              <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3" v-if="orgType.id === 'classes'">
                <span class="p-float-label">
                  <Dropdown v-model="selectedSchool" inputId="school" :options="allSchools" optionLabel="name"
                    optionValue="id" :placeholder="schoolPlaceholder" :loading="isLoadingSchools" class="w-full" />
                  <label for="school">School</label>
                </span>
              </div>
            </div>
            <RoarDataTable v-if="tableData" :key="tableKey" lazy :columns="tableColumns" :data="tableData"
              :pageLimit="pageLimit" :totalRecords="totalRecords"
              :loading="isLoading || isLoadingCount || isFetching || isFetchingCount" @page="onPage($event)"
              @sort="onSort($event)" @export-all="exportAll" />
            <AppSpinner v-else />
          </TabPanel>
        </TabView>
        <AppSpinner v-else />
      </Panel>
    </section>
  </main>
</template>
<script setup>
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import {
  orgFetcher,
  orgCounter,
  orgFetchAll,
  orgPageFetcher,
} from "@/helpers/query/orgs";
import {
  orderByDefault,
  exportCsv,
  fetchDocById,
} from "@/helpers/query/utils";
import { getSidebarActions } from "@/router/sidebarActions";
import { ref, computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from "@/store/auth";
import _get from "lodash/get";
import _head from "lodash/head";
import _isEmpty from "lodash/isEmpty";
import _union from "lodash/union";

const initialized = ref(false);
const page = ref(0);
const pageLimit = ref(10);

const selectedDistrict = ref(undefined)
const selectedSchool = ref(undefined)
const orderBy = ref(orderByDefault);

const districtPlaceholder = computed(() => {
  if (isLoadingDistricts.value) {
    return "Loading..."
  }
  return "Select a district"
})

const schoolPlaceholder = computed(() => {
  if (isLoadingSchools.value) {
    return "Loading..."
  }
  return "Select a school"
})

// Authstore and Sidebar
const authStore = useAuthStore();
const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const syncingClever = ref(false);
const cleverSyncIcon = computed(() => {
  if (syncingClever.value) {
    return "pi pi-sync pi-spin";
  } else {
    return "pi pi-cloud-download"
  }
});

const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims', authStore.uid, authStore.userQueryKeyIndex],
    queryFn: () => fetchDocById('userClaims', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const orgHeaders = computed(() => {
  const headers = {
    districts: { header: "Districts", id: 'districts' },
    schools: { header: "Schools", id: 'schools' },
    classes: { header: "Classes", id: 'classes' },
    groups: { header: "Groups", id: 'groups' },
  };

  if (isSuperAdmin.value) return headers;

  const result = {}
  if ((adminOrgs.value?.districts ?? []).length > 0) {
    result.districts = { header: "Districts", id: 'districts' };
    result.schools = { header: "Schools", id: 'schools' };
    result.classes = { header: "Classes", id: 'classes' };
  }
  if ((adminOrgs.value?.schools ?? []).length > 0) {
    result.schools = { header: "Schools", id: 'schools' };
    result.classes = { header: "Classes", id: 'classes' };
  }
  if ((adminOrgs.value?.classes ?? []).length > 0) {
    result.classes = { header: "Classes", id: 'classes' };
  }
  if ((adminOrgs.value?.groups ?? []).length > 0) {
    result.groups = { header: "Groups", id: 'groups' };
  }
  return result;
});

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value]
})

const claimsLoaded = computed(() => !isLoadingClaims.value);

const { isLoading: isLoadingDistricts, data: allDistricts } =
  useQuery({
    queryKey: ['districts'],
    queryFn: () => orgFetcher('districts', undefined, isSuperAdmin, adminOrgs),
    keepPreviousData: true,
    enabled: claimsLoaded,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const schoolQueryEnabled = computed(() => {
  return claimsLoaded.value && selectedDistrict.value !== undefined;
})

const { isLoading: isLoadingSchools, data: allSchools } =
  useQuery({
    queryKey: ['schools', selectedDistrict],
    queryFn: () => orgFetcher('schools', selectedDistrict, isSuperAdmin, adminOrgs),
    keepPreviousData: true,
    enabled: schoolQueryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingCount, isFetching: isFetchingCount, data: totalRecords } =
  useQuery({
    queryKey: ['count', activeOrgType, selectedDistrict, selectedSchool, orderBy],
    queryFn: () => orgCounter(activeOrgType, selectedDistrict, selectedSchool, orderBy, isSuperAdmin, adminOrgs),
    keepPreviousData: true,
    enabled: claimsLoaded,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading, isFetching, data: tableData } =
  useQuery({
    queryKey: ['orgsPage', activeOrgType, selectedDistrict, selectedSchool, orderBy, pageLimit, page],
    queryFn: () => orgPageFetcher(
      activeOrgType,
      selectedDistrict,
      selectedSchool,
      orderBy,
      pageLimit,
      page,
      isSuperAdmin,
      adminOrgs,
    ),
    keepPreviousData: true,
    enabled: claimsLoaded,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const exportAll = async () => {
  const exportData = await orgFetchAll(activeOrgType, selectedDistrict, selectedSchool, orderBy, isSuperAdmin, adminOrgs);
  console.log("Exporting all:", exportData)
  exportCsv(exportData, `roar-${activeOrgType.value}.csv`);
}

const tableColumns = computed(() => {
  const columns = [
    { field: 'name', header: 'Name', dataType: 'string', pinned: true },
    { field: "abbreviation", header: "Abbreviation", dataType: "string" },
    { field: "address.formattedAddress", header: "Address", dataType: "string" },
    { field: "tags", header: "Tags", dataType: "array", chip: true },
  ];

  if (["districts", "schools"].includes(activeOrgType.value)) {
    columns.push(
      { field: "mdrNumber", header: "MDR Number", dataType: "string" },
      { field: "ncesId", header: "NCES ID", dataType: "string" },
    )
  }

  if (["districts", "schools", "classes"].includes(activeOrgType.value)) {
    columns.push(
      { field: "clever", header: "Clever", dataType: "boolean" },
    )
  }

  return columns;
});

const onPage = (event) => {
  console.log("onPage", event.page);
  page.value = event.page;
  pageLimit.value = event.rows;
}

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? "ASCENDING" : "DESCENDING",
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : orderByDefault;
}

let unsubscribe;
const initTable = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
}

const { roarfirekit } = storeToRefs(authStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) initTable();
})

watch(allDistricts, (newValue) => {
  selectedDistrict.value = _get(_head(newValue), "id");
});

watch(allSchools, (newValue) => {
  selectedSchool.value = _get(_head(newValue), "id");
});

watch(activeIndex, () => {
  page.value = 0;
})

const tableKey = ref(0);
watch([selectedDistrict, selectedSchool], () => {
  page.value = 0;
  tableKey.value += 1;
});
</script>