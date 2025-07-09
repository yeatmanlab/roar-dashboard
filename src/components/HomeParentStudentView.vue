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
      <article
        class="flex overflow-hidden rounded border-gray-200 bg-gray-100 flex-column border-1 mx-auto w-full max-w-3xl p-8"
      >
        <div class="flex flex-column align-items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-pink-50 flex align-items-center justify-content-center">
            <i class="pi pi-users text-4xl text-red-700"></i>
          </div>
          <div class="text-center">
            <h2 class="m-0 text-2xl font-bold mb-2">Add a Child</h2>
            <div class="text-gray-600 mb-4 font-light text-sm">Add a new student to your family account</div>
          </div>
          <PvButton
            label="Add Child"
            class="px-6"
            severity="danger"
            outlined
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
        data-cy="enrollment-modal"
      >
        <RegisterChildren :submitting="isSubmitting" @submit="handleStudentEnrollment" />
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

const isEnrollmentModalVisible = ref(false);
const isSubmitting = ref(false);
const toast = useToast();
const consentName = ref('consent-behavioral-eye-tracking');
const emit = defineEmits(['refresh-registration']);

function showEnrollmentModal() {
  isEnrollmentModalVisible.value = true;
}

async function handleStudentEnrollment(studentData) {
  const authStore = useAuthStore();
  isSubmitting.value = true;

  try {
    // Ensure roarfirekit is initialized
    if (!authStore.initialized) {
      await authStore.initFirekit();
    }
    // Get current user's data for family association
    const { email } = authStore.firebaseUser.adminFirebaseUser;

    // Format caretaker data according to CreateParentInput interface
    const careTakerData = {
      name: {
        first: authStore.userData.firstName,
        last: authStore.userData.lastName,
      },
      legal: {
        consentType: 'family_enrollment',
        consentVersion: '1.0',
        amount: '0',
        expectedTime: '5 minutes',
        isSignedWithAdobe: false,
        dateSigned: new Date().toISOString(),
      },
    };

    // Format student data to match RegisterFamilyUsers structure
    if (!Array.isArray(studentData)) {
      console.error('studentData is not an array:', studentData);
      throw new Error('studentData must be an array');
    }

    const formattedStudentData = studentData.map((student) => {
      // Extract email from studentUsername if it's already in email format
      const email = student.studentUsername.includes('@')
        ? student.studentUsername
        : `${student.studentUsername}@roar-auth.com`;

      return {
        email,
        password: student.password,
        userData: {
          name: {
            first: student.firstName || '',
            middle: student.middleName || '',
            last: student.lastName || '',
          },
          activationCode: student.activationCode,
          grade: student.grade,
          dob: student.dob,
          gender: student.gender,
          ell_status: student.ell,
          iep_status: student.IEPStatus,
          frl_status: student.freeReducedLunch,
          race: student.race || [],
          hispanic_ethnicity: student.hispanicEthnicity,
          home_language: student.homeLanguage || [],
          accept: student.accept,
        },
      };
    });

    // Fetch the consent document to get its version
    const consentDoc = await authStore.getLegalDoc(consentName.value);
    const consentData = {
      version: consentDoc.currentCommit,
      name: consentName.value,
    };

    if (!Array.isArray(formattedStudentData)) {
      throw new Error('formattedStudentData must be an array');
    }

    await authStore.createNewFamily(
      email, // careTakerEmail
      'dummyPassword123!', // Filler password since we're using an existing account
      careTakerData,
      formattedStudentData, // properly formatted students array
      consentData, // proper consent data
      false, // isTestData
    );

    isEnrollmentModalVisible.value = false;
    isSubmitting.value = false;
    emit('refresh-registration');

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Student successfully enrolled',
      life: 3000,
    });
    // // Reload the page to reflect the new student
    // window.location.reload();
  } catch (error) {
    console.error('Error enrolling student:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to enroll student(s). Please try again.',
      life: 3000,
    });
  } finally {
    isSubmitting.value = false;
    isEnrollmentModalVisible.value = false;
  }
}
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
