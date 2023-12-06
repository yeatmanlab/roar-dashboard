<template>
  <header id="site-header" class="navbar-container">
    <nav class="container">
      <router-link :to="{ name: 'Home' }">
        <div class="navbar-logo">
          <ROARLogo />
        </div>
      </router-link>
      <div class="login-container">
        <!-- <i class="pi pi-bars menu-icon" @click="toggleMenu" /> -->
        <!-- <PvMenu ref="menu" id="overlay_menu" :model="dropdownItems" :popup="true" /> -->
        <router-link :to="{ name: 'SignOut' }" class="signout-button">
          <PvButton>Sign Out</PvButton>
        </router-link>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import _get from 'lodash/get';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

// const loggedInItems = [
//   {
//     label: `Logged in as: ${email.value}`,
//     icon: 'pi pi-user',
//     to: '/profile',
//   },
//   {
//     label: 'Log Out',
//     icon: 'pi pi-sign-out',
//     to: '/logout',
//   }
// ];

// const menu = ref();
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

// const toggleMenu = (event) => {
//   menu.value.toggle(event);
// };

// const displayInfo = ref(false);
// const openInfo = () => displayInfo.value = true;
// const closeInfo = () => displayInfo.value = false;

import ROARLogo from '@/assets/RoarLogo.vue';
</script>

<style scoped></style>
