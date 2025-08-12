<template>
  <div class="flex flex-row" :style="isModal ? {} : { maxHeight: '100vh' }">
    <!-- Sidebar -->
    <div :class="sidebarOpen ? 'sidebar-container-open' : 'sidebar-container-collapsed'">
      <div class="flex flex-column">
        <div
          class="sidebar-button cursor-pointer"
          :class="{ active: activeTab === 'info' }"
          @click="handleTabClick('info')"
        >
          <i class="pi pi-user" /><span v-if="sidebarOpen">Your Info</span>
        </div>
        <div
          v-if="isAdmin"
          class="sidebar-button cursor-pointer"
          :class="{ active: activeTab === 'password' }"
          @click="handleTabClick('password')"
        >
          <i class="pi pi-key" /><span v-if="sidebarOpen">{{ hasPassword ? 'Change Password' : 'Add Password' }}</span>
        </div>
        <div
          v-if="isAdmin"
          class="sidebar-button cursor-pointer"
          :class="{ active: activeTab === 'accounts' }"
          @click="handleTabClick('accounts')"
        >
          <i class="pi pi-users" /><span v-if="sidebarOpen">Link Accounts</span>
        </div>
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
      <component :is="currentComponent" :target-user-id="targetUserId" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, markRaw } from 'vue';
import { storeToRefs } from 'pinia';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { useAuthStore } from '@/store/auth';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { useRouter } from 'vue-router';

// Import all the possible components
import UserInfoView from '@/components/views/UserInfoView.vue';
import PasswordView from '@/components/views/PasswordView.vue';
import LinkAccountsView from '@/components/views/LinkAccountsView.vue';

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const router = useRouter();

const props = defineProps({
  isModal: { type: Boolean, default: false },
  targetUserId: { type: String, default: null },
});

const sidebarOpen = ref(!props.isModal);
const activeTab = ref('info');

// Use markRaw to avoid performance issues with Vue's reactivity system
const components = {
  info: markRaw(UserInfoView),
  password: markRaw(PasswordView),
  accounts: markRaw(LinkAccountsView),
};

const currentComponent = computed(() => components[activeTab.value]);

const handleTabClick = (tab) => {
  if (props.isModal) {
    activeTab.value = tab;
  } else {
    // If not in modal mode, use router navigation
    const routes = {
      info: '/profile',
      password: '/profile/password',
      accounts: '/profile/accounts',
    };
    router.push(routes[tab]);
  }
};

// Use targetUserId if provided, otherwise use current user
const userId = computed(() => props.targetUserId || roarfirekit.value?.admin?.user?.uid);

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
  if (state.roarfirekit.restConfig?.()) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig?.()) init();
});

const { data: userClaims } = useUserClaimsQuery({
  userId: userId,
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

.sidebar-button.active {
  background-color: var(--surface-400);
  font-weight: bold;
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
