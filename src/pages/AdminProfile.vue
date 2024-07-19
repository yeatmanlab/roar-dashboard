<template>
  <div class="flex flex-row" style="max-height: 100vh">
    <!-- Sidebar -->
    <div class="justify-content-between" :class="sidebarOpen ? 'sidebar-container' : 'sidebar-container-collapsed'">
      <div class="flex flex-column">
        <router-link to="/profile">
          <div class="sidebar-button">
            <i class="pi pi-user" /><span v-if="sidebarOpen">Your Info</span>
          </div></router-link
        >
        <router-link to="/profile/password" v-if="isAdmin"
          ><div class="sidebar-button">
            <i class="pi pi-key" /><span v-if="sidebarOpen">{{
              hasPassword ? 'Change Password' : 'Add Password'
            }}</span>
          </div></router-link
        >
        <router-link to="/profile/accounts" v-if="isAdmin"
          ><div class="sidebar-button">
            <i class="pi pi-users" /><span v-if="sidebarOpen">Link Accounts</span>
          </div></router-link
        >
      </div>
      <button @click="sidebarOpen = !sidebarOpen" class="border-none bg-primary text-white p-2 hover:surface-400">
        <div class="flex justify-content-center">
          <i v-if="!sidebarOpen" class="pi pi-angle-double-right"></i>
          <span v-if="sidebarOpen"><i class="pi pi-angle-double-left mr-2"></i>Collapse</span>
        </div>
      </button>
    </div>
    <!-- Main Page Content-->
    <div class="page-container">
      <router-view />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocById } from '@/helpers/query/utils';
import _get from 'lodash/get';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';

const authStore = useAuthStore();
const { roarfirekit, uid } = storeToRefs(authStore);
const sidebarOpen = ref(true);

const providerIds = computed(() => {
  const providerData = roarfirekit.value?.admin?.user?.providerData;
  return providerData.map((provider) => {
    return provider.providerId;
  });
});

const hasPassword = computed(() => {
  return providerIds.value.includes('password');
});

// +-------------------------+
// | Firekit Inititalization |
// +-------------------------+
const initialized = ref(false);
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

const { data: userClaims, isLoading: userClaimsLoading } = useQuery({
  queryKey: ['userClaims', uid],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Keep track of the user's type
const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
</script>
<style lang="scss" scoped>
.sidebar-container {
  background-color: var(--surface-b);
  flex-basis: 25%;
  gap: 1rem;
  height: calc(100vh - 119px);
  border-right: 2px solid var(--surface-d);
  a {
    color: black;
    text-decoration: none;
  }
}
.sidebar-button {
  width: 100%;
  background-color: var(--surface-d);
  padding: 1rem;
  color: black;
  span {
    padding-left: 0.5rem;
    color: black;
    font-weight: 500;
  }
}
.sidebar-button:hover {
  background-color: var(--surface-400);
}
.page-container {
  flex-basis: 75%;
  flex-grow: 1;
  max-height: calc(100vh - 119px);
  overflow: scroll;
  padding: 1rem;
  scroll-behavior: smooth;
}
.sidebar-container-collapsed {
  display: flex;
  flex-direction: column;
  background-color: var(--surface-b);
  flex-basis: 2rem;
  gap: 1rem;
  height: calc(100vh - 119px);
  border-right: 2px solid var(--surface-d);
}
</style>
