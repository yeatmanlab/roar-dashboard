<template>
  <div class="text-2xl font-bold text-gray-600">
    <div v-if="isLoading" class="flex items-center w-full text-center flex-column justify-content-center">
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Loading Children</div>
    </div>

    <div
      v-else-if="!parentRegistrationComplete"
      class="flex items-center w-full text-center flex-column justify-content-center"
    >
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Registration in progress</div>
    </div>

    <div v-else-if="registrationError" class="p-3">
      <PvMessage severity="error">
        <div class="text-lg font-bold text-gray-600">Error while completing registration:</div>
        <div class="text-sm font-light text-gray-800">
          {{ registrationError.message }}
        </div>
      </PvMessage>
    </div>

    <div
      v-else
      class="grid flex-wrap grid-cols-1 gap-4 w-full"
      :class="{
        'lg:grid-cols-2': childrenUids.length <= 2,
        'lg:grid-cols-3': childrenUids.length === 3,
        'lg:grid-cols-4': childrenUids.length >= 4,
      }"
      data-cy="parent-homepage__students-grid"
    >
      <div v-if="childrenUids.length === 0" class="p-3">
        <PvMessage severity="info" class="h-full">
          <div class="text-lg font-bold text-gray-600">Add your first child</div>
          <div class="text-sm font-light text-gray-800">
            You'll need to add a child to your account before they can take assessments.
          </div>
        </PvMessage>
      </div>
      <template v-else>
        <StudentCardSimple
          v-for="userId in childrenUids"
          :key="userId"
          :user-id="userId"
          :org-type="orgType"
          :org-id="orgId"
        />
      </template>
      <article
        class="flex overflow-hidden p-8 mx-auto w-full max-w-3xl bg-gray-100 rounded border-gray-200 flex-column border-1"
      >
        <div class="flex gap-4 flex-column align-items-center">
          <div class="flex w-16 h-16 bg-pink-50 rounded-full align-items-center justify-content-center">
            <i class="text-4xl text-red-700 pi pi-users"></i>
          </div>
          <div class="text-center">
            <h2 class="m-0 mb-2 text-2xl font-bold">Add a Child</h2>
            <div class="mb-4 text-sm font-light text-gray-600">Add a new student to your family account</div>
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
        pt:header:data-testid="dialog__header"
      >
        <RegisterChildren
          :submitting="isSubmitting"
          :invitation-codes="invitationCodes"
          @submit="handleStudentEnrollment"
        />
      </PvDialog>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import AppSpinner from '@/components/AppSpinner.vue';
import StudentCardSimple from '@/components/StudentCardSimple.vue';
import PvMessage from 'primevue/message';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import RegisterChildren from '@/components/auth/RegisterChildren.vue';
import { useToast } from 'primevue/usetoast';
import useAddFamilyChildren from '@/containers/HomeParent/composables/useAddFamilyChildren';

defineOptions({
  name: 'HomeParentStudentView',
});

const props = defineProps({
  isLoading: {
    type: Boolean,
    required: true,
  },
  parentRegistrationComplete: {
    type: Boolean,
    required: true,
  },
  familyId: {
    type: String,
    default: null,
  },
  childrenUids: {
    type: Array,
    default: () => [],
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
    type: Error,
    required: false,
    default: null,
  },
  invitationCodes: {
    type: Array,
    default: () => [],
  },
});

const isEnrollmentModalVisible = ref(false);
const toast = useToast();
const emit = defineEmits(['refresh-registration']);

// Add-children runs entirely against the typed backend API (`POST
// /v1/families/:familyId/users`). The legacy firekit `addStudentsToFamily` path
// — caretaker profile payload, behavioral-consent recording, and the Firestore
// family write — is gone. Consent is intentionally NOT recorded at child
// creation; each child's per-administration consent/assent is handled post-auth
// by the per-administration consent gate.
const { submit: addChildren, isSubmitting } = useAddFamilyChildren();

function showEnrollmentModal() {
  isEnrollmentModalVisible.value = true;
}

async function handleStudentEnrollment(students) {
  try {
    await addChildren({ familyId: props.familyId, students });

    isEnrollmentModalVisible.value = false;
    // The mutation invalidates the family-users / families queries; the parent
    // page also refetches on this event so the new child card appears.
    emit('refresh-registration');

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Student successfully enrolled',
      life: 3000,
    });
  } catch (error) {
    // The mapper and mutation throw structured errors (e.g. 409 duplicate email,
    // 422 invalid activation code or family-size cap). Surface a generic toast
    // and keep the modal open so the caretaker can correct and retry.
    console.error('Error enrolling student:', error);
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to enroll student(s). Please try again.',
      life: 3000,
    });
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
