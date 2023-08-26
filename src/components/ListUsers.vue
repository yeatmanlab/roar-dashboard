<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="View Users">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        <div v-if="!isLoading">
          <div v-if="showTable">
            <h2> Viewing {{ orgType }}: {{ orgName }}</h2>
            <RoarDataTable :data="users" :columns="columns" />
          </div>
          <div v-else>No users in this {{ orgType }}.</div>
        </div>
        <AppSpinner v-else />
      </Panel>
    </section>
  </main>
</template>
<script setup>
import { ref, computed } from "vue";
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "../router/sidebarActions";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";
import _isEmpty from 'lodash/isEmpty';
import _forEach from 'lodash/forEach';
import _find from 'lodash/find'
import _get from 'lodash/get';
import _set from 'lodash/set';
import _union from 'lodash/union';
import _head from 'lodash/head'
import AppSpinner from "./AppSpinner.vue";

const authStore = useAuthStore();
const queryStore = useQueryStore();
const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const props = defineProps({
  orgType: String,
  orgId: String,
})

const orgName = ref(props.orgId)

const users = ref([]);
const showTable = ref(false);
const isLoading = ref(true);

const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

async function getUsers() {
  const allOrgs = await queryStore.getOrgs(`${props.orgType}s`)
  orgName.value = _get(_find(allOrgs, org => org.id === props.orgId), 'name')
  const rawUsers = await authStore.getUsersForOrg(`${props.orgType}s`, props.orgId)
  // Process each user if necessary
  _forEach(rawUsers, user => {
    // Try to hydrate firestore date
    let dob = _get(user, 'studentData.dob')
    if(dob){
      try {
        const date = dob.toDate();
        _set(user, 'studentData.dob', date)
      } catch(e) {};
    }
  })
  users.value = rawUsers;
  // If there are no users, do not show the table
  if(!_isEmpty(rawUsers)){
    showTable.value = true;
  }
  isLoading.value = false;
}

let unsubscribe;

const refresh = async () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();
  getUsers().then(() => {
    refreshing.value = false;
  });
}

if (_isEmpty(users.value)) {
  unsubscribe = authStore.$subscribe(async (mutation, state) => {
    if (state.roarfirekit.getUsersBySingleOrg && state.roarfirekit.isAdmin()) {
      await refresh();
    }
  });
}

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
</script>