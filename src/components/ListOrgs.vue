<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Your organizations">
        <template #icons>
          <button v-if="superAdmin" v-tooltip.top="'Sync Clever orgs'" class="p-panel-header-icon mr-2"
            @click="syncClever">
            <span :class="cleverSyncIcon"></span>
          </button>
        </template>
        <TabView lazy v-model:activeIndex="activeIndex">
          <TabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
            <div v-if="initialized">
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
            </div>
            <AppSpinner v-else />
          </TabPanel>
        </TabView>
      </Panel>
    </section>
  </main>
</template>
<script setup>
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { convertValues, mapFields } from "@/helpers/firestoreRest";
import { flattenObj } from '@/helpers';
import { getSidebarActions } from "@/router/sidebarActions";
import { ref, computed, onMounted, watch } from "vue";
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from "@/store/auth";
import { storeToRefs } from "pinia";
import Papa from "papaparse";
import axios from "axios"
import _get from "lodash/get";
import _head from "lodash/head";
import _isEmpty from "lodash/isEmpty";
import _union from "lodash/union";

const initialized = ref(false);
const page = ref(0);
const pageLimit = 10;
const orgHeaders = ref({
  districts: { header: "Districts", id: 'districts' },
  schools: { header: "Schools", id: 'schools' },
  classes: { header: "Classes", id: 'classes' },
  groups: { header: "Groups", id: 'groups' },
})

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value]
})

const selectedDistrict = ref(undefined)
const selectedSchool = ref(undefined)
const orderByDefault = [
  {
    field: { fieldPath: "name" },
    direction: "ASCENDING",
  }
];
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
const superAdmin = ref(authStore.isUserSuperAdmin());
const cleverSyncIcon = computed(() => {
  if (syncingClever.value) {
    return "pi pi-sync pi-spin";
  } else {
    return "pi pi-cloud-download"
  }
});

const getRequestBody = ({
  orgType,
  parentDistrict,
  parentSchool,
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
          { fieldPath: "abbreviation" },
          { fieldPath: "address" },
          { fieldPath: "clever" },
          { fieldPath: "districtContact" },
          { fieldPath: "id" },
          { fieldPath: "mdrNumber" },
          { fieldPath: "name" },
          { fieldPath: "ncesId" },
          { fieldPath: "tags" },
        ]
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: orgType,
      allDescendants: false,
    }
  ];

  if (orgType === "schools" && parentDistrict) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "districtId" },
        op: "EQUAL",
        value: { stringValue: parentDistrict }
      }
    }
  } else if (orgType === "classes" && parentSchool) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "schoolId" },
        op: "EQUAL",
        value: { stringValue: parentSchool }
      }
    }
  }

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

const { roarfirekit } = storeToRefs(authStore);

const counter = (activeOrgType, selectedDistrict, selectedSchool, orderBy) => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);
  const requestBody = getRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value ?? _get(_head(allDistricts.value), "id"),
    parentSchool: selectedSchool.value ?? _get(_head(allSchools.value), "id"),
    aggregationQuery: true,
    orderBy: orderBy.value,
    paginate: false,
    skinnyQuery: true,
  });
  console.log(`Fetching count for ${activeOrgType.value}`, requestBody);
  return axiosInstance.post(":runAggregationQuery", requestBody).then(({ data }) => {
    return Number(convertValues(data[0].result?.aggregateFields?.count));
  })
}

const schoolFetcher = (selectedDistrict) => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);

  const parentDistrict = selectedDistrict.value ?? _get(_head(allDistricts.value), "id");
  const requestBody = getRequestBody({
    orgType: "schools",
    parentDistrict,
    aggregationQuery: false,
    paginate: false,
    skinnyQuery: true,
  });

  console.log(`Fetching schools for ${parentDistrict}`, requestBody);
  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}

const districtFetcher = () => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);

  const requestBody = getRequestBody({
    orgType: "districts",
    aggregationQuery: false,
    paginate: false,
    skinnyQuery: true,
  });

  console.log(`Fetching districts`);
  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}

const pageFetcher = (activeOrgType, selectedDistrict, selectedSchool, orderBy, page) => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);

  const requestBody = getRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value ?? _get(_head(allDistricts.value), "id"),
    parentSchool: selectedSchool.value ?? _get(_head(allSchools.value), "id"),
    aggregationQuery: false,
    orderBy: orderBy.value,
    paginate: true,
    skinnyQuery: false,
  });

  console.log(`Fetching page ${page.value} for ${activeOrgType.value}`, requestBody);
  return axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
}

const { isLoading: isLoadingDistricts, data: allDistricts } =
  useQuery({
    queryKey: ['districts'],
    queryFn: () => districtFetcher(),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const schoolQueryEnabled = computed(() => {
  return selectedDistrict.value !== undefined;
})

const { isLoading: isLoadingSchools, data: allSchools } =
  useQuery({
    queryKey: ['schools', selectedDistrict],
    queryFn: () => schoolFetcher(selectedDistrict),
    keepPreviousData: true,
    enabled: schoolQueryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading: isLoadingCount, isFetching: isFetchingCount, data: totalRecords } =
  useQuery({
    queryKey: ['count', activeOrgType, selectedDistrict, selectedSchool, orderBy],
    queryFn: () => counter(activeOrgType, selectedDistrict, selectedSchool, orderBy),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading, isFetching, data: tableData } =
  useQuery({
    queryKey: ['orgsPage', activeOrgType, selectedDistrict, selectedSchool, orderBy, page],
    queryFn: () => pageFetcher(activeOrgType, selectedDistrict, selectedSchool, orderBy, page),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const exportAll = async () => {
  const axiosOptions = roarfirekit.value.restConfig?.admin ?? {};
  const axiosInstance = axios.create(axiosOptions);

  const requestBody = getRequestBody({
    orgType: activeOrgType.value,
    parentDistrict: selectedDistrict.value ?? _get(_head(allDistricts.value), "id"),
    parentSchool: selectedSchool.value ?? _get(_head(allSchools.value), "id"),
    aggregationQuery: false,
    orderBy: orderBy.value,
    paginate: false,
    skinnyQuery: false,
  });

  const exportData = await axiosInstance.post(":runQuery", requestBody).then(({ data }) => mapFields(data));
  const csvData = exportData.map(flattenObj);
  const csvColumns = _union(...csvData.map(Object.keys));
  const csv = Papa.unparse(exportData.map(flattenObj), {
    columns: csvColumns,
  });

  const blob = new Blob([csv]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob, { type: 'text/plain' });
  a.download = `roar-${activeOrgType.value}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  page.value = event.page;
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

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) initTable();
})

watch(allDistricts, (newValue) => {
  if (selectedDistrict.value === undefined) {
    selectedDistrict.value = _get(_head(newValue), "id");
  }
});

watch(allSchools, (newValue) => {
  if (selectedSchool.value === undefined) {
    selectedSchool.value = _get(_head(newValue), "id");
  }
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