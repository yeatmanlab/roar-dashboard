<template>
  <h1>Permission denied</h1>
  <div class="col-full">
    <Message severity="warn" class="text-left" :closable="false">
      You are logged in as {{ authStore.email }}, but this account does not have
      sufficient permissions to query ROAR assessment data.
    </Message>
    <Message v-if="authStore.hasRequested" severity="info" class="text-left" :closable="false">
      You have requested access to the the ROAR assessment data. Please allow
      a few business days to be granted access to the ROAR-query.
    </Message>
    <Button v-else label="Request Access" icon="pi pi-lock-open"
    @click="authStore.requestAccess" />
  </div>
</template>

<script setup>
import { useAuthStore } from "@/store/auth";

const authStore = useAuthStore();
</script>