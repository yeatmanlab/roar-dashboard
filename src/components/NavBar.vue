<template>
  <header id="site-header" class="navbar-container">
    <nav class="flex flex-row align-items-center justify-content-between w-full">
      <div id="navBarRightEnd" class="flex flex-row align-items-center justify-content-start w-full gap-1">
        <div class="flex align-items-center justify-content-center w-full">
          <PvMenubar :model="computedItems" class="w-full">
            <template #start>
              <router-link :to="{ name: 'Home' }">
                <div class="navbar-logo mx-3">
                  <PvImage v-if="isLevante" src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
                  <ROARLogo v-else />
                </div>
              </router-link>
            </template>
            <template #menubuttonicon>
              <PvButton
                icon="pi pi-bars mr-2"
                class="bg-primary text-white p-2 mr-2 border-none border-round hover:bg-red-900"
                label="Menu"
                @click="toggleMenu"
              />
            </template>
            <template #end>
              <div class="flex gap-2 align-items-center justify-content-center mr-3">
                <div v-if="isWideScreen" class="nav-user-wrapper flex align-items-center gap-2 bg-gray-100">
                  <div class="text-lg font-bold text-gray-600">
                    {{ userDisplayName }}
                  </div>
                  <router-link :to="{ name: 'SignOut' }" class="signout-button">
                    <PvButton
                      text
                      data-cy="button-sign-out"
                      class="no-underline h-2 p-1 m-0 text-primary border-none border-round h-2rem text-sm hover:bg-red-900 hover:text-white"
                      >{{ $t('navBar.signOut') }}
                    </PvButton>
                  </router-link>
                </div>
                <div v-else>
                  <router-link :to="{ name: 'SignOut' }" class="signout-button">
                    <PvButton
                      data-cy="button-sign-out"
                      class="no-underline m-0 bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
                      >{{ $t('navBar.signOut') }}</PvButton
                    >
                  </router-link>
                </div>
                <div class="nav-user-wrapper bg-gray-100">
                  <router-link :to="{ name: 'ProfileInfo' }"
                    ><button
                      class="no-underline p-1 m-0 text-primary border-none border-round cursor-pointer h-2rem w-2rem text-sm hover:bg-red-900 hover:text-white"
                    >
                      <i class="pi pi-cog"></i></button
                  ></router-link>
                </div>
                <div class="my-2">
                  <LanguageSelector />
                </div>
              </div>
            </template>
          </PvMenubar>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import _get from 'lodash/get';
import { getSidebarActions } from '@/router/sidebarActions';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import ROARLogo from '@/assets/RoarLogo.vue';
import LanguageSelector from './LanguageSelector.vue';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit, uid } = storeToRefs(authStore);
const initialized = ref(false);
const menu = ref();
const screenWidth = ref(window.innerWidth);
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
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// ---------------------------------------------------------------

const { data: userClaims, isLoading: userClaimsLoading } = useQuery({
  queryKey: ['userClaims', uid],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const isWideScreen = computed(() => {
  return screenWidth.value > 728;
});

const computedItems = computed(() => {
  const items = [];
  const headers = ['Administrations', 'Organizations', 'Users'];
  for (const header of headers) {
    const headerItems = rawActions.value
      .filter((action) => action.category === header)
      .map((action) => {
        return {
          label: action.title,
          icon: action.icon,
          command: () => {
            router.push(action.buttonLink);
          },
        };
      });
    if (headerItems.length > 0) {
      items.push({
        label: header,
        items: headerItems,
      });
    }
  }
  return items;
});

const handleResize = () => {
  screenWidth.value = window.innerWidth;
  return;
};

const userDisplayName = computed(() => {
  if (!userClaimsLoading) {
    return '';
  } else {
    let email = authStore?.userData?.email;
    if (email && email.split('@')[1] === 'roar-auth.com') {
      email = email.split('@')[0];
    }
    const displayName = authStore?.userData?.displayName;
    const username = authStore?.userData?.username;
    const firstName = authStore?.userData?.name?.first;
    if (isAdmin.value === true) {
      return 'Hi, ' + (displayName || username || email || 'Admin') + '!';
    } else {
      return 'Hi, ' + (firstName || displayName || username || email || 'User') + '! 👋';
    }
  }
});

const isAdmin = computed(() => {
  if (userClaims.value?.claims?.super_admin) return true;
  if (_isEmpty(_union(...Object.values(userClaims.value?.claims?.minimalAdminOrgs ?? {})))) return false;
  return true;
});

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));

const isAtHome = computed(() => {
  return router.currentRoute.value.fullPath === '/';
});

const rawActions = computed(() => {
  return getSidebarActions({
    isSuperAdmin: isSuperAdmin.value,
    isAdmin: authStore.isUserAdmin,
    includeHomeLink: !isAtHome.value,
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
</script>

<style scoped>
nav {
  min-width: 100%;
}

.signout-button {
  font-size: 0.6rem !important;
  font-weight: 500;
}

.nav-user-wrapper {
  display: flex;
  align-items: center;
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.3rem;
  padding: 0.5rem 0.8rem;
}
</style>
