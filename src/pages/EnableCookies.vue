<template>
  <h1>Enable Third-Party Cookies</h1>
  <Message severity="warn" class="text-left" :closable="false">
    We tried to log you in but were unable to do so because the login method
    that you selected required third-party cookies to be enabled. Please enable
    third-party cookies and then click below to sign in.
  </Message>
  <router-link :to="{ name: 'Login' }">
    <Button label="Log In" icon="pi pi-sign-in" />
  </router-link>
</template>

<script>
export default {
  created() {
    this.$emit("ready");
  },
};
</script>

<style scoped></style>
