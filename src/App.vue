<script setup>
import { ref } from "vue";
import TheNavbar from "./components/TheNavbar.vue";
import SignInOrRegister from "./components/SignInOrRegister.vue";
import { useAuthStore } from "./store/auth";

const authStore = useAuthStore();
</script>

<template>
  <TheNavbar />
  <SignInOrRegister v-if="!authStore.isAuthenticated" />
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
