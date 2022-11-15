<template>
  <AppSpinner />
</template>

<script setup>
import { useAuthStore } from "@/store/auth";

const authStore = useAuthStore();
</script>