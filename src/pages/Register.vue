<template>
  
  <div id="register-container">
    <!-- <div class="step-container">
      <div class="card stepper">
        <Steps :model="items" :readonly="true" :activeIndex="activeIndex" @change="onStepChange" aria-label="Form Steps" />
      </div>
    </div> -->
    
    <section id="register">
      <header>
        <div class="signin-logo">
          <ROARLogoShort />
        </div>
      </header>
      <div>
        <div v-if="activeIndex === 0">
          <router-view name="registerParent">
            <div class="register-title">
              <h1 align="center">Register for ROAR</h1>
              <p align="center">Enter your information to create an account.</p>
            </div>
            <Register />
          </router-view>
        </div>
        <div v-else="activeIndex === 1">
          <router-view name="registerStudent">
            <div class="register-title">
              <h1 align="center">Register your child</h1>
              <p align="center">Enter your child's information to create their ROAR account.</p>
            </div>
            <RegisterStudent />
          </router-view>
        </div>
      </div>
    </section>
    
    <button @click="prevStep">Previous</button>
    <button @click="nextStep">Next</button>
  </div>

</template>

<script setup>
import Register from "../components/auth/RegisterParent.vue";
import RegisterStudent from "../components/auth/RegisterStudent.vue";
import ROARLogoShort from "@/assets/RoarLogo-Short.vue";
import { ref, onMounted, onBeforeUnmount } from 'vue';
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
    
onMounted(() => {
  document.body.classList.add('page-register')
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-register')
});

</script>

<style scoped>
.step-container {
  width: 40%;
  margin: auto;
}

.step-container {
  width: 26.875rem;
  margin-top: 3rem;
}
</style>
