<template>
  <div id="register-container">
    <section id="register">
      <header>
        <div class="signin-logo">
          <ROARLogoShort />
        </div>
      </header>
      <div>
        <div v-if="activeIndex === 0" class="register-title">
              <h1 align="center">Register for ROAR</h1>
              <p align="center">Enter your information to create an account.</p>
        </div>
        <div v-else class="register-title">
            <PvButton class="w-6rem justify-start" @click="activeIndex=0"> ← Back </PvButton>
            <h1 align="center">Register your child</h1>
            <p align="center">Enter your child's information to create their ROAR account.</p>
        </div>
        <div>
          <KeepAlive>
              <component :is="activeComp()" @submit="handleSubmit($event)" />
          </KeepAlive>
        </div>
        <PvDialog v-model:visible="isDialogVisible" :header="dialogHeader" :style="{ width: '25rem' }" :position="position" :modal="true" :draggable="false">
          <p>{{ dialogMessage }}</p>
          <PvButton @click="closeDialog">Close</PvButton>
        </PvDialog>
      </div>
    </section>
  </div>
</template>

<script setup>
import Register from '../components/auth/RegisterParent.vue';
import RegisterStudent from '../components/auth/RegisterStudent.vue';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { ref, onMounted, onBeforeUnmount, watch, toRaw } from 'vue';
import { useAuthStore } from '@/store/auth';
import router from '../router';

const authStore = useAuthStore();

const activeIndex = ref(0); // Current active step
// const activeComp = ref(Register);

const parentInfo = ref(null);
const studentInfo = ref(null);
const dialogHeader = ref('');
const dialogMessage = ref('');

const isDialogVisible = ref(false);

const showDialog = () => {
  isDialogVisible.value = true;
};

const closeDialog = () => {
  isDialogVisible.value = false;
  router.push({ name: 'SignIn'});
};

async function handleParentSubmit(data) {
  try {
    parentInfo.value = data;
    activeIndex.value = 1;
  } catch (error) {
    dialogHeader.value = 'Error!';
    dialogMessage.value = error.message;
    showDialog();
  }
}

async function handleStudentSubmit(data) {
  try {
    studentInfo.value = data;
  } catch (error) {
    dialogHeader.value = 'Error!';
    dialogMessage.value = error.message;
    showDialog();
  }
};

async function handleSubmit(event) {
  if(activeComp() == RegisterStudent) {
    handleStudentSubmit(event);
    
  }
  else{
    handleParentSubmit(event);
    activeIndex.value = 1;
    activeComp();
  }
}

function activeComp() {
  if(activeIndex.value === 0) {
    return Register;
  }
  else {
    return RegisterStudent;
  }
};

watch([parentInfo, studentInfo], ([newParentInfo, newStudentInfo]) => {
  if (newParentInfo && newStudentInfo) {
    const rawParentInfo = toRaw(newParentInfo);
    const rawStudentInfo = toRaw(newStudentInfo);
    console.log('both student and parent info present');
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
    authStore.createNewFamily(rawParentInfo.ParentEmail, rawParentInfo.password, parentUserData, studentSendObject);
    console.log('firekit function called');
    dialogHeader.value = 'Success!';
    dialogMessage.value = 'Your family has been created!';
    showDialog();
  }
});

onMounted(() => {
  document.body.classList.add('page-register');
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-register');
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
