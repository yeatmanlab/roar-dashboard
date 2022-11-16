<template>
  <div class="col-full text-center">
    <h1>Page not found</h1>
    <p>Sorry! We couldn't find that page.</p>
    <router-link :to="{ name: 'Home' }">
      <Button label="Click here to go to the home page" icon="pi pi-home" />
    </router-link>
  </div>
</template>

<script>
export default {
  created() {
    this.$emit("ready");
  },
};
</script>

<style scoped></style>
