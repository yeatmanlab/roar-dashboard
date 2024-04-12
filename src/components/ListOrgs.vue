<template>
  <main class="container main">
    <section class="main-body">
      <PvPanel header="Your organizations">
        <template #icons>
          <button
            v-if="isSuperAdmin"
            v-tooltip.top="'Sync Clever orgs'"
            class="p-panel-header-icon mr-2"
            @click="syncClever"
          >
            <span :class="cleverSyncIcon"></span>
          </button>
        </template>
        <PvTabView v-if="claimsLoaded" v-model:activeIndex="activeIndex" lazy>
          <PvTabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
            <div class="grid column-gap-3 mt-2">
              <div
                v-if="activeOrgType === 'schools' || activeOrgType === 'classes'"
                class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3"
              >
                <span class="p-float-label">
                  <PvDropdown
                    v-model="selectedDistrict"
                    input-id="district"
                    :options="allDistricts"
                    option-label="name"
                    option-value="id"
                    :placeholder="districtPlaceholder"
                    :loading="isLoadingDistricts"
                    class="w-full"
                    data-cy="dropdown-parent-district"
                  />
                  <label for="district">District</label>
                </span>
              </div>
              <div v-if="orgType.id === 'classes'" class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
                <span class="p-float-label">
                  <PvDropdown
                    v-model="selectedSchool"
                    input-id="school"
                    :options="allSchools"
                    option-label="name"
                    option-value="id"
                    :placeholder="schoolPlaceholder"
                    :loading="isLoadingSchools"
                    class="w-full"
                    data-cy="dropdown-parent-school"
                  />
                  <label for="school">School</label>
                </span>
              </div>
            </div>
            <RoarDataTable
              v-if="tableData"
              :key="tableKey"
              lazy
              :columns="tableColumns"
              :data="tableData"
              :page-limit="pageLimit"
              :total-records="totalRecords"
              :loading="isLoading || isLoadingCount || isFetching || isFetchingCount"
              :allow-filtering="false"
              @page="onPage($event)"
              @sort="onSort($event)"
              @export-all="exportAll"
            />
            <AppSpinner v-else />
          </PvTabPanel>
        </PvTabView>
        <AppSpinner v-else />
      </PvPanel>
    </section>
  </main>
</template>
<script setup>
import { orgFetcher, orgCounter, orgFetchAll, orgPageFetcher } from '@/helpers/query/orgs';
import { orderByDefault, exportCsv, fetchDocById } from '@/helpers/query/utils';
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import _get from 'lodash/get';
import _head from 'lodash/head';
import _isEmpty from 'lodash/isEmpty';

const toast = useToast();
const initialized = ref(false);
const page = ref(0);
const pageLimit = ref(10);
const orgsQueryKeyIndex = ref(0);

const selectedDistrict = ref(undefined);
const selectedSchool = ref(undefined);
const orderBy = ref(orderByDefault);

const districtPlaceholder = computed(() => {
  if (isLoadingDistricts.value) {
    return 'Loading...';
  }
  return 'Select a district';
});

const schoolPlaceholder = computed(() => {
  if (isLoadingSchools.value) {
    return 'Loading...';
  }
  return 'Select a school';
});

// Authstore and Sidebar
const authStore = useAuthStore();

const syncingClever = ref(false);
const cleverSyncIcon = computed(() => {
  if (syncingClever.value) {
    return 'pi pi-sync pi-spin';
  } else {
    return 'pi pi-cloud-download';
  }
});

const syncClever = async () => {
  toast.add({ severity: 'info', summary: 'Syncing', detail: 'Clever sync initiated', life: 3000 });
  syncingClever.value = true;
  await authStore.syncCleverOrgs();
  syncingClever.value = false;
  orgsQueryKeyIndex.value += 0;
  toast.add({ severity: 'success', summary: 'Success', detail: 'Clever sync successful', life: 5000 });
};

const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
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
    districts: { header: 'Districts', id: 'districts' },
    schools: { header: 'Schools', id: 'schools' },
    classes: { header: 'Classes', id: 'classes' },
    groups: { header: 'Groups', id: 'groups' },
  };

  if (isSuperAdmin.value) return headers;

  const result = {};
  if ((adminOrgs.value?.districts ?? []).length > 0) {
    result.districts = { header: 'Districts', id: 'districts' };
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.schools ?? []).length > 0) {
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.classes ?? []).length > 0) {
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.groups ?? []).length > 0) {
    result.groups = { header: 'Groups', id: 'groups' };
  }
  return result;
});

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value];
});

const claimsLoaded = computed(() => !isLoadingClaims.value);

const { isLoading: isLoadingDistricts, data: allDistricts } = useQuery({
  queryKey: ['districts', authStore.uid, orgsQueryKeyIndex],
  queryFn: () => orgFetcher('districts', undefined, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: claimsLoaded,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const schoolQueryEnabled = computed(() => {
  return claimsLoaded.value && selectedDistrict.value !== undefined;
});

const { isLoading: isLoadingSchools, data: allSchools } = useQuery({
  queryKey: ['schools', authStore.uid, selectedDistrict, orgsQueryKeyIndex],
  queryFn: () => orgFetcher('schools', selectedDistrict, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: schoolQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const {
  isLoading: isLoadingCount,
  isFetching: isFetchingCount,
  data: totalRecords,
} = useQuery({
  queryKey: ['count', authStore.uid, activeOrgType, selectedDistrict, selectedSchool, orderBy, orgsQueryKeyIndex],
  queryFn: () => orgCounter(activeOrgType, selectedDistrict, selectedSchool, orderBy, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: claimsLoaded,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const {
  isLoading,
  isFetching,
  data: orgData,
} = useQuery({
  queryKey: [
    'orgsPage',
    authStore.uid,
    activeOrgType,
    selectedDistrict,
    selectedSchool,
    orderBy,
    pageLimit,
    page,
    orgsQueryKeyIndex,
  ],
  queryFn: () =>
    orgPageFetcher(activeOrgType, selectedDistrict, selectedSchool, orderBy, pageLimit, page, isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: claimsLoaded,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const exportAll = async () => {
  const exportData = await orgFetchAll(
    activeOrgType,
    selectedDistrict,
    selectedSchool,
    orderBy,
    isSuperAdmin,
    adminOrgs,
  );
  console.log('Exporting all:', exportData);
  exportCsv(exportData, `roar-${activeOrgType.value}.csv`);
};

const tableColumns = computed(() => {
  const columns = [
    { field: 'name', header: 'Name', dataType: 'string', pinned: true, sort: false },
    { field: 'abbreviation', header: 'Abbreviation', dataType: 'string', sort: false },
    { field: 'address.formattedAddress', header: 'Address', dataType: 'string', sort: false },
    { field: 'tags', header: 'Tags', dataType: 'array', chip: true, sort: false },
  ];

  if (['districts', 'schools'].includes(activeOrgType.value)) {
    columns.push(
      { field: 'mdrNumber', header: 'MDR Number', dataType: 'string', sort: false },
      { field: 'ncesId', header: 'NCES ID', dataType: 'string', sort: false },
    );
  }

  if (['districts', 'schools', 'classes'].includes(activeOrgType.value)) {
    columns.push({ field: 'clever', header: 'Clever', dataType: 'boolean', sort: false });
  }

  columns.push({
    link: true,
    routeName: 'ListUsers',
    routeTooltip: 'View users',
    routeLabel: 'Users',
    routeIcon: 'pi pi-user',
    sort: false,
  });

  return columns;
});

const tableData = computed(() => {
  if (isLoading.value) return [];
  return orgData.value.map((org) => {
    return {
      ...org,
      routeParams: {
        orgType: activeOrgType.value,
        orgId: org.id,
        orgName: org.name,
      },
    };
  });
});

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
};

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : orderByDefault;
};

let unsubscribe;
const initTable = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const { roarfirekit } = storeToRefs(authStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) initTable();
});

watch(allDistricts, (newValue) => {
  selectedDistrict.value = _get(_head(newValue), 'id');
});

watch(allSchools, (newValue) => {
  selectedSchool.value = _get(_head(newValue), 'id');
});

watch(activeIndex, () => {
  page.value = 0;
});

const tableKey = ref(0);
watch([selectedDistrict, selectedSchool], () => {
  page.value = 0;
  tableKey.value += 1;
});
</script>
