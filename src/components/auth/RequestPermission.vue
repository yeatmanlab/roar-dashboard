<template>
  <h1>Permission denied</h1>
  <div class="col-full">
    <PvMessage severity="warn" class="text-left" :closable="false">
      You are logged in as {{ email }}, but this account does not have sufficient permissions to query ROAR assessment
      data.
    </PvMessage>
    <PvMessage v-if="authStore.hasRequestedAccess" severity="info" class="text-left" :closable="false">
      You have requested access to the the ROAR assessment data. Please allow a few business days to be granted access
      to the ROAR-query.
    </PvMessage>
    <PvButton v-else label="Request Access" icon="pi pi-lock-open" @click="authStore.requestAccess" />
  </div>
</template>

<script setup>
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvMessage from 'primevue/message';

const authStore = useAuthStore();
const { email } = storeToRefs(authStore);
</script>
