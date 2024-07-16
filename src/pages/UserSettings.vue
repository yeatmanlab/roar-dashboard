<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex align-items-center flex-wrap gap-3 mb-2">
          <i class="pi pi-pencil text-gray-400 rounded" style="font-size: 1.6rem" />
          <div class="admin-page-header">Update Settings</div>
        </div>
        <div class="text-md text-gray-500 ml-6">Update user settings and configurations.</div>
      </div>
      <PvDivider />
      <div class="flex flex-column justify-content-between mx-auto md:flex-none">
        <div class="flex bg-gray-100 rounded p-4 flex-row justify-content-around">
          <div class="">
            <div class="text-lg font-bold text-gray-600">Offline Mode</div>
            <div class="text-xs text-light text-gray-40">
              Note: Offline Mode is currently under development and users may encounter a higher frequency of bugs or
              irregular behavior.
            </div>
          </div>
          <div>
            <PvSelectButton v-model="offlineMode" :options="offlineOptions" class="p-2" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue';

const offlineOptions = ref(['On', 'Off']);
const offlineMode = ref('Off');
</script>

<style scoped>
.register-container {
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  border-color: #e5e5e5;
  background-color: #fcfcfc;
  width: 75%;
  position: relative;
}

.contact-text {
  padding-top: 2.75rem;
  padding-bottom: 2rem;
  text-align: left;
}

.button-container {
  display: flex;
  gap: 1.125rem;
  justify-content: center;
  margin-bottom: 6.5rem;
}

.signin-button {
  background-color: #e5e5e5;
  border-color: #c4c4c4;
  color: black;
  width: 8rem;
}

.signin-button:hover {
  background-color: #b7b5b5;
  border-color: black;
  color: black;
}

.text-btn {
  border: none;
  background-color: inherit;
  cursor: pointer;
  display: inline-block;
  font-size: 16px;
  color: #2c3e50;
}
</style>
