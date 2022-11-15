<template>
  <h1>Enable Third-Party Cookies</h1>
  <p class="text-left">
    We tried to log you in but were unable to do so because the login method
    that you selected required third-party cookies to be enabled. Please enable
    third-party cookies and then click below to sign in.
  </p>
  <router-link :to="{ name: 'SignIn' }">
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
