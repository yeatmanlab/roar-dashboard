<template>
  <div class="col-full text-center">
    <h1>Not Found</h1>
    <router-link :to="{ name: 'Home' }">Click here to go home!</router-link>
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
