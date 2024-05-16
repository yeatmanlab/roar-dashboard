<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="!isLoading">
        <div class="flex flex-column mb-5">
          <div class="flex justify-content-between">
            <div class="flex align-items-center gap-3">
              <i class="pi pi-users text-gray-400 rounded" style="font-size: 1.6rem"></i>
              <div class="admin-page-header">List Users</div>
            </div>
            <div class="bg-gray-100 px-5 py-2 rounded">
              <div class="uppercase font-light font-sm text-gray-400 mb-1">
                {{ singularizeFirestoreCollection(orgType) }}
              </div>
              <div class="text-xl text-gray-600">
                <b> {{ orgName }} </b>
              </div>
            </div>
          </div>
          <div class="text-md text-gray-500 ml-6">View users for the selected organization.</div>
        </div>

        <RoarDataTable
          v-if="users"
          :columns="columns"
          :data="users"
          :loading="isLoading || isFetching"
          :allow-export="false"
          :allow-filtering="false"
          @sort="onSort($event)"
        />
      </div>
      <AppSpinner v-else />
    </section>
  </main>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import _isEmpty from 'lodash/isEmpty';
import { useQuery } from '@tanstack/vue-query';
import AppSpinner from './AppSpinner.vue';
import { storeToRefs } from 'pinia';
import { fetchUsersByOrg } from '@/helpers/query/users';
import { singularizeFirestoreCollection } from '@/helpers';

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);

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
  isLoading,
  isFetching,
  data: users,
} = useQuery({
  queryKey: ['usersByOrgPage', authStore.uid, props.orgType, props.orgId, page, orderBy],
  queryFn: () => fetchUsersByOrg(props.orgType, props.orgId, ref(1000000), page, orderBy),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const columns = ref([
  {
    field: 'username',
    header: 'Username',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'email',
    header: 'Email',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'name.first',
    header: 'First Name',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'name.last',
    header: 'Last Name',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.grade',
    header: 'Grade',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.gender',
    header: 'Gender',
    dataType: 'string',
    sort: false,
  },
  {
    field: 'studentData.dob',
    header: 'Date of Birth',
    dataType: 'date',
    sort: false,
  },
  {
    field: 'userType',
    header: 'User Type',
    dataType: 'string',
    sort: false,
  },
]);

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
