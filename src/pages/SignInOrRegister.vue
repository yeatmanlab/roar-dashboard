<template>
  <div class="flex align-items-center justify-content-center">
    <TabView>
      <TabPanel header="Sign in">
        <SignIn :isRegistering="false" />
      </TabPanel>
      <TabPanel header="Register">
        <SignIn :isRegistering="true" />
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup>
import SignIn from "@/components/auth/SignIn.vue";
</script>

<style>

</style>
