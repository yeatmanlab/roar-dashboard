<template>
  <div class="step-container mx-auto">
    <div class="card stepper">
      <Steps :model="steps" :readonly="true" aria-label="Form Steps" />
    </div>
  </div>

  <div class="register-container mx-auto md:flex-none">
    <router-view v-slot="{Component}" >
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>

</template>

<script setup>
import { ref } from 'vue';
import Steps from 'primevue/steps';

const steps = ref([
  { label: 'Parent Registration', to: "/register" },
  { label: 'Student Registration', to: "/register/student" },
]);

</script>

<style scoped>
.register-container {
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  border-color: #E5E5E5;
  background-color: #FCFCFC;
  width: 26.875rem;
  padding-right: 1.5rem;
  padding-left: 1.5rem;
  margin-top: 2rem;
  position: relative;
}

.step-container {
  width: 26.875rem;
  margin-top: 3rem;
}
</style>
