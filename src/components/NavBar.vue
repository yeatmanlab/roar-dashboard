<template>
  <header id="site-header" class="navbar-container">
    <nav class="container flex flex-row align-items-center justify-content-between">
      <router-link :to="{ name: 'Home' }">
        <div class="navbar-logo">
          <PvImage v-if="isLevante" src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
          <ROARLogo v-else />
        </div>
      </router-link>

      <div id="navBarRightEnd" class="flex flex-row align-items-center justify-content-start">
        <div class="login-container gap-2">
          <div class="">
            <LanguageSelector />
          </div>
          <div v-if="isAdmin" class="flex align-items-center">
            <PvButton label="Menu" icon="pi pi-bars" @click="toggleMenu" />
            <PvMenu ref="menu" :model="dropDownActions" :popup="true" class="p-1">
              <template #item="{ item }">
                <div class="cursor-pointer hover:surface-200">
                  <i :class="item.icon" class="pb-2 pt-2 mx-1 my-1 text-sm cursor-pointer"></i> {{ item.label }}
                </div>
              </template>
            </PvMenu>
          </div>
          <div v-if="isWideScreen" class="nav-user-wrapper flex align-items-center gap-2 bg-gray-100">
            <div class="text-lg font-bold text-gray-600">
              {{ userDisplayName }}
            </div>
            <router-link :to="{ name: 'SignOut' }" class="signout-button">
              <PvButton data-cy="button-sign-out" class="no-underline h-2 p-1">{{ $t('navBar.signOut') }}</PvButton>
            </router-link>
          </div>
          <div v-else>
            <router-link :to="{ name: 'SignOut' }" class="signout-button">
              <PvButton data-cy="button-sign-out" class="no-underline p-2">{{ $t('navBar.signOut') }}</PvButton>
            </router-link>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import _get from 'lodash/get';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { getSidebarActions } from '@/router/sidebarActions';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import ROARLogo from '@/assets/RoarLogo.vue';
import LanguageSelector from './LanguageSelector.vue';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);
const menu = ref();
const userMenu = ref();
const isLevante = import.meta.env.MODE === 'LEVANTE';
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

const { data: userClaims } = useQuery({
  queryKey: ['userClaims', authStore.uid],
  queryFn: () => fetchDocById('userClaims', authStore.uid),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const isWideScreen = computed(() => {
  return window.innerWidth > 768;
});

const userDisplayName = computed(() => {
  const email = authStore?.userData?.email;
  const displayName = authStore?.userData?.displayName;
  const username = authStore?.userData?.username;
  console.log(authStore.userData.username)
  return username || email || displayName || "User";
})

const userMenuOptions = [
  {
    label: "signout",
    icon: 'pi pi-sign-out',
    command: () => {
      authStore.signOut();
    },
  },
]

const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));

const isAtHome = computed(() => {
  return router.currentRoute.value.fullPath === '/';
});

const dropDownActions = computed(() => {
  const rawActions = getSidebarActions({
    isSuperAdmin: isSuperAdmin.value,
    isAdmin: isAdmin.value,
    includeHomeLink: !isAtHome.value,
  });
  return rawActions.map((action) => {
    return {
      label: action.title,
      icon: action.icon,
      command: () => {
        router.push(action.buttonLink);
      },
    };
  });
});

let dropdownItems = ref([
  {
    label: authStore.isAuthenticated ? 'Home' : 'Log in',
    icon: authStore.isAuthenticated ? 'pi pi-user' : 'pi pi-sign-in',
    command: () => {
      authStore.isAuthenticated ? router.push({ name: 'Home' }) : router.push({ name: 'SignIn' });
    },
  },
  {
    label: 'Sign Out',
    icon: 'pi pi-sign-out',
    command: () => {
      router.push({ name: 'SignOut' });
    },
  },
]);

if (authStore.isAuthenticated && _get(roarfirekit.value, 'userData.userType') === 'admin') {
  dropdownItems.value.splice(
    1,
    0,
    {
      label: 'Student Upload',
      icon: 'pi pi-users',
      command: () => {
        router.push({ name: 'RegisterStudents' });
      },
    },
    {
      label: 'Query',
      icon: 'pi pi-cloud-download',
      command: () => {
        router.push({ name: 'Query' });
      },
    },
    {
      label: 'Score Report',
      icon: 'pi pi-upload',
      command: () => {
        router.push({ name: 'UploadScores' });
      },
    },
  );
}

const toggleMenu = (event) => {
  menu.value.toggle(event);
};

const toggleUserMenu = (event) => {
  userMenu.value.toggle(event)
}

</script>

<style scoped>
nav {
  min-width: 100%;
}

.nav-user-wrapper {
  display: flex;
  align-items: center;
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.3rem;
  padding: 0.5rem .8rem;
}
</style>
