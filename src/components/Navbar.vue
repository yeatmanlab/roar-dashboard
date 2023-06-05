<template>
  <div class="navbar-container">
    <router-link :to="{ name: 'Home' }">
      <div class="navbar-logo">
        <img src="../assets/stanford-roar.svg" height="50" alt="The ROAR Logo" />
      </div>
    </router-link>
    <div class="login-container">
      <!-- <SplitButton v-if="authStore.isAuthenticated" label="Account" icon="pi pi-user" :model="loggedInItems">
      </SplitButton>
      <router-link v-else :to="{ name: 'Login' }">
        <Button label="Log In" icon="pi pi-sign-in" />
      </router-link> -->
      <i class="pi pi-bars menu-icon" @click="toggleMenu" />
      <Menu ref="menu" id="overlay_menu" :model="dropdownItems" :popup="true" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from "@/store/auth";

const router = useRouter()
const authStore = useAuthStore();
const { email } = storeToRefs(authStore);

const loggedInItems = [
  {
    label: `Logged in as: ${email.value}`,
    icon: 'pi pi-user',
    to: '/profile',
  },
  {
    label: 'Log Out',
    icon: 'pi pi-sign-out',
    to: '/logout',
  }
];

const menu = ref();
const dropdownItems = ref([
  {
    label: authStore.isAuthenticated ? 'Account' : 'Log in',
    icon: authStore.isAuthenticated ? 'pi pi-user' : 'pi pi-sign-in',
    command: () => {
      authStore.isAuthenticated ? router.push({ name: 'Home' }) : router.push({ name: 'SignIn' })
    }
  },
  {
    label: 'Student Upload',
    icon: 'pi pi-users',
    command: () => {
      router.push({name: 'MassUploader'})
    }
  },
  {
    label: 'Query',
    icon: 'pi pi-cloud-download',
    command: () => {
      router.push({name: 'Query'})
    }
  },
  {
    label: 'Score Report',
    icon: 'pi pi-upload',
    command: () => {
      router.push({name: 'UploadScores'})
    }
  }
])

const toggleMenu = (event) => {
  menu.value.toggle(event);
};

const displayInfo = ref(false);
const openInfo = () => displayInfo.value = true;
const closeInfo = () => displayInfo.value = false;
</script>

<style scoped>
</style>
