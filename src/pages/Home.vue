<template>
  <Participant v-if="!isAdminRef"/>
  <Administrator v-else-if="isAdminRef" />
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from '@/store/auth';
import Participant from "./Participant.vue";
import Administrator from "./Administrator.vue";
const authStore = useAuthStore();
const isAdmin = authStore.isUserAdmin();
const isAdminRef = ref(isAdmin)
</script>