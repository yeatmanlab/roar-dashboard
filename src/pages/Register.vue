<template>
  <div id="register-container">
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
        <div v-else="activeIndex === 1">
          <router-view name="registerStudent">
            <div class="register-title">
              <h1 align="center">Register your child</h1>
              <p align="center">
                Enter your child's information to create their ROAR account.
              </p>
            </div>
            <div>
              <!-- Iterate through the list of students -->
              <div class="student-form">
                <div class="student-form-border">
                  <RegisterStudent @submit="handleStudentSubmit($event)" />
                </div>
              </div>
            </div>
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
import { ref, onMounted, onBeforeUnmount, watch, toRaw } from "vue";
import { useQueryStore } from "@/store/query";
import { useAuthStore } from "@/store/auth";
import { useToast } from "primevue/usetoast";
import { storeToRefs } from "pinia";
import VueRecaptcha from "vue-recaptcha";

// import {useAuthStore} from "@/store/auth";
// import Steps from 'primevue/steps';

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const toast = useToast();

const activeIndex = ref(0); // Current active step
const items = ref([{ label: "Step 1" }, { label: "Step 2" }]);

const parentInfo = ref(null);
const studentInfo = ref(null);

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

async function handleParentSubmit(data) {
  console.log("Parent data: ", data);
  parentInfo.value = data;

  // const SendParentObject = {
  //   email: data.usernameOrEmail,
  //   password: data.password,
  //   UserData: {
  //     name: {
  //       first: data.firstName,
  //       last: data.lastName,
  //     },
  //   },
  //   children: [],
  // };

  // try {
  //   await roarfirekit.value.createNewFamily(
  //     SendParentObject.email,
  //     SendParentObject.password,
  //     SendParentObject.UserData
  //   );

  //   toast.add({
  //     severity: "success",
  //     summary: "Success",
  //     detail: "Parent account created",
  //     life: 3000,
  //   });
  // } catch (error) {
  //   // Handle any potential errors here
  //   console.error("Error creating parent account:", error);
  //   toast.add({
  //     severity: "error",
  //     summary: "Error",
  //     detail: "Failed to create parent account",
  //     life: 3000,
  //   });
  // }
}

function handleStudentSubmit(data) {
  console.log("Student data: ", data);
  studentInfo.value = data;
}

watch(
  [parentInfo, studentInfo],
  ([newParentInfo, newStudentInfo], [oldParentInfo, oldStudentInfo]) => {
    if (newParentInfo && newStudentInfo) {
      const rawParentInfo = toRaw(newParentInfo);
      const rawStudentInfo = toRaw(newStudentInfo);
      console.log("both student and parent info present:");
      console.log("parent", rawParentInfo);
      console.log("student", rawStudentInfo);
      const parentUserData = {
        name: {
          first: rawParentInfo.firstName,
          last: rawParentInfo.lastName,
        },
      };
      const studentSendObject = rawStudentInfo.map((student) => {
        return {
          email: student.studentUsername,
          password: student.password,
          userData: {
            name: {
              first: student.firstName,
              middle: student.middleName,
              last: student.lastName,
            },
            activationCode: student.activationCode,
            grade: student.grade,
            dob: student.dob,
            gender: student.gender,
            ell_status: student.ell,
            iep_status: student.IEPStatus,
            frl_status: student.freeReducedLunch,
            race: student.race,
            hispanic_ethnicity: student.hispanicEthnicity,
            home_language: student.homeLanguage,
          },
        };
      });
      authStore.createNewFamily(
        rawParentInfo.ParentEmail,
        rawParentInfo.password,
        parentUserData,
        studentSendObject
      );
      console.log("firekit function called");
    }
  }
);

onMounted(() => {
  document.body.classList.add("page-register");
});

onBeforeUnmount(() => {
  document.body.classList.remove("page-register");
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

.submit-button {
  margin: auto;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  background-color: #e5e5e5;
  color: black;
  border: none;
  width: 11.75rem;
  justify-content: center;
  align-items: center;
}
.submit-button:hover {
  background-color: #8c1515;
  color: #e5e5e5;
}
#register .form-submit {
  justify-content: center;
  margin-top: 2rem;
  align-items: center;
  display: flex;
}
</style>
