<template>
  <header id="site-header" class="navbar-container">
    <nav class="container">
      <router-link :to="{ name: 'Home' }">
        <div class="navbar-logo">
          <ROARLogo />
        </div>
      </router-link>
      <div class="login-container">
        <div v-if="isSuperAdmin">
          <PvButton label="Menu" icon="pi pi-bars" @click="toggleMenu" />
          <PvMenu ref="menu" :model="dropDownActions" :popup="true">
            <template #item="{ item }" >
              <div class="cursor-pointer hover:surface-200">
                <i :class="item.icon" class="p-1 pb-2 pt-2 text-sm cursor-pointer"></i> {{ item.label }}
              </div>
            </template>       
          </PvMenu>
        </div>
        <router-link :to="{ name: 'SignOut' }" class="signout-button no-underline">
          <PvButton>Sign Out</PvButton>
        </router-link>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref,computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import _get from 'lodash/get';
 import {getSidebarActions} from '@/router/sidebarActions'
 import { fetchDocById } from '@/helpers/query/utils';
 import { useQuery } from '@tanstack/vue-query';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(true);

const { data: userClaims } = useQuery({
  queryKey: ['userClaims', authStore.uid],
  queryFn: () => fetchDocById('userClaims', authStore.uid),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

 const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));


const isAtHome = computed(()=>{
  return router.currentRoute.value.fullPath === '/'
});

const dropDownActions = computed(() => {
  const rawActions = getSidebarActions(authStore.isUserSuperAdmin, !isAtHome.value);
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

const menu = ref();
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

// const displayInfo = ref(false);
// const openInfo = () => displayInfo.value = true;
// const closeInfo = () => displayInfo.value = false;

import ROARLogo from '@/assets/RoarLogo.vue';
</script>

<style scoped></style>
