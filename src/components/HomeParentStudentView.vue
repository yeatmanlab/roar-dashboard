[
<template>
  <div class="text-2xl font-bold text-gray-600">
    <div v-if="isLoading" class="flex items-center w-full text-center flex-column justify-content-center">
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Loading Assignments</div>
    </div>

    <div
      v-else-if="!parentRegistrationComplete"
      class="flex items-center w-full text-center flex-column justify-content-center"
    >
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Administration enrollment in progress</div>
    </div>

    <div v-else-if="registrationError?.length < 0" class="p-3">
      <PvMessage severity="error">
        <div class="text-lg font-bold text-gray-600">Error while fetching registrations status:</div>
        <div class="text-sm font-light text-gray-800">{{ registrationError }}</div>
      </PvMessage>
    </div>

    <div v-else-if="Object.keys(childrenAssignments).length === 0" class="p-3">
      <PvMessage severity="info">
        <div class="text-lg font-bold text-gray-600">No assignments available</div>
        <div class="text-sm font-light text-gray-800">Please check back later.</div>
      </PvMessage>
    </div>

    <div
      v-else
      class="grid flex-wrap grid-cols-1 gap-4 w-full"
      :class="{
        'lg:grid-cols-2': Object.keys(childrenAssignments).length <= 2,
        'lg:grid-cols-3': Object.keys(childrenAssignments).length === 3,
        'lg:grid-cols-4': Object.keys(childrenAssignments).length >= 4,
      }"
    >
      <template v-for="(assignments, userId) in childrenAssignments" :key="userId">
        <StudentCard :assignments="assignments" :user-id="userId" :org-type="orgType" :org-id="orgId" />
      </template>
      <article class="flex overflow-hidden rounded border-gray-200 flex-column border-1 mx-auto w-full max-w-3xl">
        <div class="flex gap-2 p-3 bg-gray-100 flex-column">
          <h2 class="m-0 text-xl font-bold text-center">
            Enroll New Student
            <div class="text-sm font-light">Add a student to your family account</div>
          </h2>
        </div>
        <div class="flex justify-content-center p-4">
          <PvButton
            label="Add Student"
            icon="pi pi-plus"
            severity="primary"
            size="small"
            data-cy="add-student-btn"
            @click="showEnrollmentModal"
          />
        </div>
      </article>

      <PvDialog
        v-model:visible="isEnrollmentModalVisible"
        modal
        :style="{ width: '80vw', maxWidth: '1200px' }"
        header="Enroll New Student"
        :closable="true"
        :draggable="false"
      >
        <RegisterChildren @submit="handleStudentEnrollment" />
      </PvDialog>
    </div>
  </div>
</template>

<script setup>
import AppSpinner from '@/components/AppSpinner.vue';
import StudentCard from '@/components/StudentCard.vue';
import PvMessage from 'primevue/message';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import RegisterChildren from '@/components/auth/RegisterChildren.vue';
import { ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useToast } from 'primevue/usetoast';

defineOptions({
  name: 'HomeParentStudentView',
});

const isEnrollmentModalVisible = ref(false);
const toast = useToast();

function showEnrollmentModal() {
  isEnrollmentModalVisible.value = true;
}

async function handleStudentEnrollment(studentData) {
  const authStore = useAuthStore();

  try {
    // Get current user's data for family association
    const { email } = authStore.userData;
    const careTakerData = {
      name: {
        first: authStore.userData.firstName,
        middle: authStore.userData.middleName,
        last: authStore.userData.lastName,
      },
      grade: authStore.userData.grade,
      language: authStore.userData.language,
      username: authStore.userData.username,
    };

    await authStore.createNewFamily(
      email, // careTakerEmail
      null, // careTakerPassword not needed for existing user
      careTakerData,
      studentData, // students array
      null, // consentData
      false, // isTestData
    );

    isEnrollmentModalVisible.value = false;

    // Show success message
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Student(s) successfully enrolled in your family',
      life: 3000,
    });
  } catch (error) {
    console.error('Error enrolling students:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to enroll student(s). Please try again.',
      life: 3000,
    });
  }
  console.log('Student enrollment data:', studentData);
  isEnrollmentModalVisible.value = false;
}

defineProps({
  isLoading: {
    type: Boolean,
    required: true,
  },
  parentRegistrationComplete: {
    type: Boolean,
    required: true,
  },
  childrenAssignments: {
    type: Object,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
  registrationError: {
    type: String,
    required: false,
    default: '',
  },
});
</script>

<style>
.grid {
  display: grid !important;
  margin: 0 !important;
}

@media (min-width: 1024px) {
  .grid > * {
    max-width: 575px;
    width: 100%;
  }
}
</style>
