<template>
  <div class="step-container">
    <div class="card stepper">
      <Steps :model="items" :readonly="true" :activeIndex="activeIndex" @change="onStepChange" aria-label="Form Steps" />
    </div>
  </div>

  <div class="register-container mx-auto md:flex-none">
    <div v-if="activeIndex === 0">
      <router-view name="registerParent">
        <Register />
      </router-view>
    </div>
    <div v-else="activeIndex === 1">
      <router-view name="registerStudent">
        <RegisterStudent />
      </router-view>
    </div>
  </div>

  <button @click="prevStep">Previous</button>
  <button @click="nextStep">Next</button>


  <!-- <div>
    <div class="register-container mx-auto md:flex-none">
      <Register />
    </div>
  </div> -->
</template>

<script setup>
import Register from "../components/auth/Register.vue";
import RegisterStudent from "../components/auth/RegisterStudent.vue";
import { ref } from 'vue';
import Steps from 'primevue/steps';

const activeIndex = ref(0); // Current active step
    const items = ref([
      { label: 'Step 1' },
      { label: 'Step 2' },
    ]);

    function onStepChange(event) {
      activeIndex.value = event.index;
    }

    function prevStep() {
      if (activeIndex.value > 0) {
        activeIndex.value--;
      }
    }

    function nextStep() {
      if (activeIndex.value < items.value.length - 1) {
        activeIndex.value++;
      }
    }
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
  margin-top: 6.5rem;
  position: relative;
}

.step-container {
  width: 40%;
  margin: auto;
}
</style>
