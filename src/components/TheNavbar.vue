<template>
  <div class="redline" />
  <div class="navbar-container">
    <router-link :to="{ name: 'Home' }">
      <!-- <img src="../assets/roar-icon.png" height="50" style="margin: 2.25rem" alt="The ROAR Logo" /> -->
      <div class="navbar-logo">
        <img src="../assets/stanford-roar.svg" height="50" alt="The ROAR Logo" />
      </div>
    </router-link>
    <div class="login-container">
      <SplitButton v-if="authStore.isAuthenticated" label="Account" icon="pi pi-user" :model="loggedInItems">
      </SplitButton>
      <router-link v-else :to="{ name: 'Login' }">
        <Button label="Log In" icon="pi pi-sign-in" />
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { storeToRefs } from 'pinia'
import { useAuthStore } from "@/store/auth";

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

const displayInfo = ref(false);
const openInfo = () => displayInfo.value = true;
const closeInfo = () => displayInfo.value = false;
</script>

<style scoped>
.redline {
  width: 100%;
  border-top: 7px solid #A80532;
}
.navbar-container { 
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #E5E5E5;
  border-bottom: 1px solid #E5E5E5;
}
.navbar-logo {
  margin-top: 1.25rem;
  margin-left: 2rem;
  margin-bottom: 1.25rem;
}
.login-container {
  margin-right: 2rem;
}
</style>
