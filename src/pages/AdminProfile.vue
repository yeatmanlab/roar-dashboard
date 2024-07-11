<template>
  <div class="flex flex-row" style="max-height: 100vh">
    <!-- Sidebar -->
    <div v-if="sidebarOpen" class="sidebar-container justify-content-between">
      <div class="flex flex-column gap-3">
        <router-link to="/profile">
          <div class="sidebar-button"><i class="pi pi-user" /><span>Your Info</span></div></router-link
        >
        <router-link to="/profile/password"
          ><div class="sidebar-button"><i class="pi pi-key" /><span>Change Password</span></div></router-link
        >
        <router-link to="/profile/accounts"
          ><div class="sidebar-button"><i class="pi pi-users" /><span>Link Accounts</span></div></router-link
        >
      </div>
      <button @click="sidebarOpen = !sidebarOpen" class="border-none bg-primary text-white p-2 hover:surface-400">
        <div class="flex justify-content-center"><i class="pi pi-angle-double-left mr-2"></i> Collapse</div>
      </button>
    </div>
    <!-- Collapsed Sidebar -->
    <div v-else class="sidebar-container-collapsed justify-content-between">
      <div class="flex flex-column gap-3">
        <router-link to="/profile">
          <div class="sidebar-button"><i class="pi pi-user" /></div
        ></router-link>
        <router-link to="/profile/password"
          ><div class="sidebar-button"><i class="pi pi-key" /></div
        ></router-link>
        <router-link to="/profile/accounts"
          ><div class="sidebar-button"><i class="pi pi-users" /></div
        ></router-link>
      </div>
      <button @click="sidebarOpen = !sidebarOpen" class="border-none bg-primary text-white p-2 hover:surface-400">
        <div class="flex justify-content-center">
          <i class="pi pi-angle-double-right"></i>
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
import { ref } from 'vue';
const sidebarOpen = ref(true);
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
