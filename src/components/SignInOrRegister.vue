<template>
  <div class="mt-8 flex align-items-center justify-content-center">
    <TabView>
      <TabPanel header="Log in">
        <SignIn :isRegistering="false" />
      </TabPanel>
      <TabPanel header="Register">
        <SignIn :isRegistering="true" />
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup>
import SignIn from "../pages/SignIn.vue";
</script>

<style></style>
