<template>
  <div class="navbar-container">
    <router-link :to="{ name: 'Home' }">
      <div class="navbar-logo">
        <img src="../assets/stanford-roar.svg" height="50" alt="The ROAR Logo" />
      </div>
    </router-link>
    <div class="login-container">
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
let dropdownItems = ref([
  {
    label: authStore.isUserAuthed() ? 'Home' : 'Log in',
    icon: authStore.isUserAuthed() ? 'pi pi-user' : 'pi pi-sign-in',
    command: () => {
      authStore.isUserAuthed() ? router.push({ name: 'Home' }) : router.push({ name: 'SignIn' })
    }
  },
  // TODO TEMP ==================
  {
    label: 'Participant View',
    icon: 'pi pi-flag',
    command: () => {
      router.push({ name: 'Participant'})
    }
  },
  // ENDTEMP ====================
  {
    label: 'Sign Out',
    icon: 'pi pi-sign-out',
    command: () => {
      router.push({name: 'SignOut'})
    }
  }
])

if(authStore.adminClaims /* check for proper claim */ ){
  dropdownItems.splice(1, 0, {
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
  })
}


const toggleMenu = (event) => {
  menu.value.toggle(event);
};

const displayInfo = ref(false);
const openInfo = () => displayInfo.value = true;
const closeInfo = () => displayInfo.value = false;
</script>

<style scoped>
</style>
