<template>
  <Toolbar>
    <template #start>
      <img src="../assets/roar-lion.svg" height="50" alt="The ROAR logo" />
      <!-- <router-link :to="{ name: 'Home' }" class="logo">
      </router-link> -->
    </template>

    <template #end>
      <Button @click="logUser" icon="pi pi-user" />
    </template>
  </Toolbar>
</template>

<script setup>
import { useAuthStore } from "../store/auth";

const authStore = useAuthStore();

const logUser = () => {
  console.log("authStore.uid:", authStore.uid);
  console.log("authStore.firebaseUser:", authStore.firebaseUser);
  console.log("authStore.isAuthenticated:", authStore.isAuthenticated);
  console.log("authStore.email:", authStore.email);
  console.log("authStore.userDoc:", authStore.userDoc);
};
</script>

<style scoped></style>
