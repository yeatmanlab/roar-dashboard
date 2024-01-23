<template>
  <main class="container main">
    <section class="main-body">
      <PvPanel header="View Users">
        <div v-if="!(isLoading || isLoadingCount)">
          <h2>Users in {{ singularizeFirestoreCollection(orgType) }} {{ orgName }}</h2>
          <RoarDataTable
            v-if="users"
            lazy
            :columns="columns"
            :data="users"
            :page-limit="pageLimit"
            :total-records="totalRecords"
            :loading="isLoading || isLoadingCount || isFetching || isFetchingCount"
            :allow-export="false"
            @page="onPage($event)"
            @sort="onSort($event)"
          />
        </div>
        <AppSpinner v-else />
      </PvPanel>
    </section>
  </main>
</template>
<script setup>
import { ref, onMounted} from 'vue';
import { useAuthStore } from '@/store/auth';
import _isEmpty from 'lodash/isEmpty';
import { useQuery } from '@tanstack/vue-query';
import AppSpinner from './AppSpinner.vue';
import { storeToRefs } from 'pinia';
import { countUsersByOrg, fetchUsersByOrg } from '@/helpers/query/users';
import { singularizeFirestoreCollection } from '@/helpers';

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);



const pageLimit = ref(10);
const page = ref(0);
const orderBy = ref(null);

const props = defineProps({
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
  orgName: {
    type: String,
    required: true,
  },
});

const {
  isLoading: isLoadingCount,
  isFetching: isFetchingCount,
  data: totalRecords,
} = useQuery({
  queryKey: ['countUsers', props.orgType, props.orgId, orderBy],
  queryFn: () => countUsersByOrg(props.orgType, props.orgId, orderBy),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const {
  isLoading,
  isFetching,
  data: users,
} = useQuery({
  queryKey: ['usersByOrgPage', props.orgType, props.orgId, pageLimit, page, orderBy],
  queryFn: () => fetchUsersByOrg(props.orgType, props.orgId, pageLimit, page, orderBy),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const columns = ref([
  {
    field: 'username',
    header: 'Username',
    dataType: 'string',
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
    dataType: 'string',
  },
  {
    field: 'studentData.dob',
    header: 'Date of Birth',
    dataType: 'date',
  },
  {
    field: 'userType',
    header: 'User Type',
    dataType: 'string',
  },
]);

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
};

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : null;
};

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});
</script>
