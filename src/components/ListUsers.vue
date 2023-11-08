<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="View Users">
        <div v-if="!(isLoading || isLoadingCount)">
          <h2> Users in {{ singularizeFirestoreCollection(orgType) }} {{ orgName }}</h2>
          <RoarDataTable v-if="users" lazy :columns="columns" :data="users" :pageLimit="pageLimit"
            :totalRecords="totalRecords" :loading="isLoading || isLoadingCount || isFetching || isFetchingCount"
            @page="onPage($event)" @sort="onSort($event)" :allowExport="false" />
        </div>
        <AppSpinner v-else />
      </Panel>
    </section>
  </main>
</template>
<script setup>
import { ref, onMounted, computed } from "vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";
import { useAuthStore } from "@/store/auth";
import _isEmpty from 'lodash/isEmpty';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find'
import _get from 'lodash/get';
import _set from 'lodash/set';
import _union from 'lodash/union';
import _head from 'lodash/head'
import { useQuery } from "@tanstack/vue-query";
import AppSpinner from "./AppSpinner.vue";
import { storeToRefs } from "pinia";
import { countUsersByOrg, fetchUsersByOrg } from "@/helpers/query/users";
import { fetchDocById } from "../helpers/query/utils";
import { singularizeFirestoreCollection } from "@/helpers";

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);

const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims'],
    queryFn: () => fetchDocById('userClaims', roarfirekit.value.roarUid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const sidebarActions = ref(getSidebarActions(isSuperAdmin, true));

const pageLimit = ref(10);
const page = ref(0);
const orderBy = ref(null);

const props = defineProps({
  orgType: String,
  orgId: String,
  orgName: String,
})

const { isLoading: isLoadingCount, isFetching: isFetchingCount, data: totalRecords } =
  useQuery({
    queryKey: ['countUsers', props.orgType, props.orgId, orderBy],
    queryFn: () => countUsersByOrg(props.orgType, props.orgId, orderBy),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const { isLoading, isFetching, data: users } =
  useQuery({
    queryKey: ['usersByOrgPage', props.orgType, props.orgId, pageLimit, page, orderBy],
    queryFn: () => fetchUsersByOrg(
      props.orgType,
      props.orgId,
      pageLimit,
      page,
      orderBy,
    ),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const columns = ref([
  {
    field: 'username',
    header: 'Username',
    dataType: 'string'
  },
  {
    field: 'name.first',
    header: 'First Name',
    dataType: 'string',
  },
  {
    field: 'name.last',
    header: 'Last Name',
    dataType: 'string',
  },
  {
    field: 'studentData.grade',
    header: 'Grade',
    dataType: 'string',
  },
  {
    field: 'studentData.gender',
    header: 'Gender',
    dataType: 'string'
  },
  {
    field: 'studentData.dob',
    header: 'Date of Birth',
    dataType: 'date'
  },
  {
    field: 'userType',
    header: 'User Type',
    dataType: 'string',
  }
])

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
}

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? "ASCENDING" : "DESCENDING",
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : null;
}

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
}

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
})
</script>