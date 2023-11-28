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
            <Register @submit="handleParentSubmit($event)" />
          </router-view>
        </div>
        <!-- <div v-else="activeIndex === 1">
          <router-view name="registerStudent">
            <div class="register-title">
              <h1 align="center">Register your child</h1>
              <p align="center">Enter your child's information to create their ROAR account.</p>
            </div>
            <RegisterStudent />
          </router-view> -->
        <div v-else="activeIndex === 1">
          <router-view name="registerStudent">
            <div class="register-title">
              <h1 align="center">Register your child</h1>
              <p align="center">Enter your child's information to create their ROAR account.</p>
            </div>
            <div>
              <!-- Iterate through the list of students -->
              <div v-for="(student, index) in students" :key="index" class="student-form">
                <div class="student-form-border">
                  <RegisterStudent v-model="students[index]" />
                  <!-- Button to delete the current student -->
                  <button v-if="index !==0" @click="deleteStudentForm(index)" class="p-button p-component">Delete Student</button>
                </div>
              </div>
              <!-- Button to add another student form -->
              <button @click="addStudentForm" class="p-button p-component">Add Another Student</button>
            </div>
            <section class="form-submit">
              <Button @click="handleFormSubmit()" type="submit" label="Submit" class="submit-button"/>
            </section>
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
// import {useAuthStore} from "@/store/auth";
import Steps from 'primevue/steps';

const activeIndex = ref(0); // Current active step
    const items = ref([
      { label: 'Step 1' },
      { label: 'Step 2' },
    ]);

    const parentInfo = ref(null);

    const students = ref([{}]); // Initialize with an empty student form
    // const authStore = useAuthStore();
    // const parentFormData = ref(null);

    // onMounted(() => {
    //   parentFormData.value = authStore.getParentFormData();
    // })

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

    function addStudentForm() {
      students.value.push({}); // Add a new empty student object to the students array
    }

    function deleteStudentForm(index) {
      if (students.value.length > 1) {
        students.value.splice(index, 1); // Remove the student at the specified index
      } else {
        alert("At least one student is required."); // Prevent deleting the last student form
      }
    }
    function handleFormSubmit(event){
      // students.forEach(s => {
      //   console.log(s)
      // });

      // console.log("submit function triggered", event)
    }
    function handleParentSubmit(data){
      // console.log("data: ",data)
      parentInfo.value = data
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


.student-form-border {
  border: 2px solid #ccc; /* Add a border around each student form */
  padding: 20px; /* Add padding for better spacing */
  margin: 5px;/* Add margin for better spacing */
}

  .submit-button {
  margin: auto;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    display: flex;
    background-color: #E5E5E5;
    color: black;
    border: none;
    width: 11.75rem;
    justify-content: center;
    align-items: center;
  }
  .submit-button:hover {
    background-color: #8c1515;
    color: #E5E5E5;
  }
  #register .form-submit {
    justify-content: center;
    margin-top: 2rem;
    align-items: center;
    display: flex;
  }
</style>
