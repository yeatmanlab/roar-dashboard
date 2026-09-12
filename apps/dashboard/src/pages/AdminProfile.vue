<template>
  <div class="flex flex-row" style="max-height: 100vh">
    <!-- Sidebar -->
    <div :class="sidebarOpen ? 'sidebar-container-open' : 'sidebar-container-collapsed'">
      <div class="flex flex-column">
        <router-link to="/profile">
          <div class="sidebar-button">
            <i class="pi pi-user" /><span v-if="sidebarOpen">Your Info</span>
          </div></router-link
        >
        <router-link v-if="isAdmin" to="/profile/password"
          ><div class="sidebar-button">
            <i class="pi pi-key" /><span v-if="sidebarOpen">{{
              hasPassword ? 'Change Password' : 'Add Password'
            }}</span>
          </div></router-link
        >
        <router-link v-if="isAdmin" to="/profile/accounts"
          ><div class="sidebar-button">
            <i class="pi pi-users" /><span v-if="sidebarOpen">Link Accounts</span>
          </div></router-link
        >
        <router-link v-if="isAdmin" to="/profile/offline"
          ><div class="sidebar-button">
            <i class="pi pi-wifi" /><span v-if="sidebarOpen">Offline Settings</span>
          </div></router-link
        >
      </div>
      <button
        class="w-full border-none cursor-pointer h-3rem flex align-items-center"
        :class="sidebarOpen ? 'justify-content-end' : 'justify-content-center'"
        style="background-color: var(--surface-b)"
        @click="sidebarOpen = !sidebarOpen"
      >
        <i
          v-if="!sidebarOpen"
          class="pi text-2xl pi-angle-double-right text-grey-600"
          style="color: var(--surface-400)"
        ></i>
        <i v-else class="pi text-2xl pi-angle-double-left mr-2 text-grey-600" style="color: var(--surface-400)"></i>
      </button>
    </div>
    <!-- Main Page Content-->
    <div class="page-container">
      <router-view />
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import useCurrentUser from '@/composables/useCurrentUser';

const authStore = useAuthStore();
const sidebarOpen = ref(true);
const { data: currentUser } = useCurrentUser();

// Profile navigation is an identity classification, not an organization permission.
const isAdmin = computed(
  () => Boolean(currentUser.value?.isSuperAdmin) || ['admin', 'educator'].includes(currentUser.value?.userType),
);
const hasPassword = computed(
  () => authStore.firebaseUser?.providerData?.some((provider) => provider.providerId === 'password') ?? false,
);
</script>

<style lang="scss" scoped>
.sidebar-container-open {
  background-color: var(--surface-b);
  flex-basis: 25%;
  width: 100%;
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
  height: calc(100vh - 119px);
  border-right: 2px solid var(--surface-d);
}
</style>
