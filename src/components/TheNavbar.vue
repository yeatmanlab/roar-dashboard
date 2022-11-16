<template>
  <Toolbar class="mb-2">
    <template #start>
      <router-link :to="{ name: 'Home' }">
        <img src="../assets/roar-icon.png" height="50" alt="The ROAR logo" />
      </router-link>
      <h1 class="ml-2">ROAR Web Query</h1>
      <Button icon="pi pi-info-circle" class="p-button-rounded p-button-secondary p-button-text" @click="openInfo"/>
      <Dialog header="What is ROAR?" v-model:visible="displayInfo" position="topleft" :breakpoints="{'960px': '75vw', '640px': '90vw'}" :style="{width: '50vw'}">
        <div class="text-left">
          <p>
            The <b>Rapid Online Assessment of Reading (ROAR)</b> is an ongoing
            academic research project and online platform for assessing foundational
            reading skills. The ROAR is a suite of measures; each is delivered
            through the web browser and does not require a test administrator. The
            ROAR rapidly provides highly reliable indices of reading ability
            consistent with scores on other standardized reading assessments.
          </p>

          <p>
            This website serves as a tool to interactively query ROAR assessment
            data.  If you are an educator, clinician, student, or parent wishing to
            learn more about the ROAR, please visit the <a
            href="https://roar.stanford.edu/">ROAR website.</a>
          </p>
        </div>
        <template #footer>
            <Button label="Close" icon="pi pi-check" @click="closeInfo" autofocus />
        </template>
      </Dialog>
    </template>

    <template #end>
      <SplitButton v-if="authStore.isAuthenticated" label="Account" icon="pi pi-user" :model="loggedInItems"></SplitButton>
      <router-link v-else :to="{ name: 'SignIn' }">
        <Button label="Log In" icon="pi pi-sign-in" />
      </router-link>
    </template>
  </Toolbar>
</template>

<script setup>
import { ref } from 'vue';
import { storeToRefs } from 'pinia'
import { useAuthStore } from "@/store/auth";

const authStore = useAuthStore();
const { email } = storeToRefs(authStore);

const loggedInItems = ref([
  {
    label: `Logged in as: ${email.value}`,
    icon: 'pi pi-user',
    to: '/profile',
  },
  {
    label: 'Log Out',
    icon: 'pi pi-sign-out',
    to: '/logout',
  }
]);

const displayInfo = ref(false);
const openInfo = () => displayInfo.value = true;
const closeInfo = () => displayInfo.value = false;
</script>

<style scoped></style>
