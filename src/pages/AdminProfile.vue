<template>
  <div class="flex flex-row" style="max-height: 100vh">
    <!-- Sidebar -->
    <div :class="sidebarOpen ? 'sidebar-container-open' : 'sidebar-container-collapsed'">
      <div class="flex flex-column">
        <router-link v-if="!isLevante" to="/profile">
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
        <router-link to="/profile/settings"
          ><div class="sidebar-button">
            <i class="pi pi-cog" /><span v-if="sidebarOpen">{{ t('profile.settings.settings') }}</span>
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
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { useAuthStore } from '@/store/auth';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { isLevante } from '@/helpers';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
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

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

// Keep track of the user's type
const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});
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
