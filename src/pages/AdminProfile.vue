<template>
  <div class="flex flex-row" style="max-height: 100vh">
    <!-- Sidebar -->
    <div class="sidebar-container">
      <router-link to="/profile"><div class="sidebar-button">Your Info</div></router-link>
      <router-link to="/profile/password"><div class="sidebar-button">Change Password</div></router-link>
      <router-link to="/profile/accounts"><div class="sidebar-button">Link Accounts</div></router-link>
    </div>
    <!-- Main Page Content-->
    <div class="page-container">
      <router-view />
    </div>
  </div>
</template>
<style lang="scss" scoped>
.sidebar-container {
  background-color: var(--surface-b);
  flex-basis: 25%;
  height: calc(100vh - 119px);
  border-right: 2px solid var(--surface-d);
}
.sidebar-button {
  width: 100%;
  background-color: var(--surface-d);
  padding: 1rem;
}
.page-container {
  flex-basis: 75%;
  flex-grow: 1;
  max-height: calc(100vh - 119px);
  overflow: scroll;
  padding: 1rem;
  scroll-behavior: smooth;
}
</style>
