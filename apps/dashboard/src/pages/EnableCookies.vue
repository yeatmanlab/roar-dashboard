<template>
  <h1>Enable Third-Party Cookies</h1>
  <PvMessage severity="warn" class="text-left" :closable="false">
    We tried to log you in but were unable to do so because the login method that you selected required third-party
    cookies to be enabled. Please enable third-party cookies and then click below to sign in.
  </PvMessage>
  <router-link :to="{ name: 'Login' }">
    <PvButton label="Log In" icon="pi pi-sign-in" />
  </router-link>
</template>

<script setup>
import PvButton from 'primevue/button';
import PvMessage from 'primevue/message';
</script>
