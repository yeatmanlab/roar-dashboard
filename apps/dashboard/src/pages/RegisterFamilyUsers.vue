<template>
  <div id="register-container">
    <section id="register">
      <header>
        <div class="flex flex-wrap p-3 justify-content-around align-items-center gap-3">
          <div class="signin-logo">
            <ROARLogoShort />
          </div>
          <div class="flex flex-wrap flex-column align-items-start gap-2">
            <div class="flex">
              <div class="text-center font-bold text-3xl text-red-800 mb-1 italic">ROAR@Home</div>
              <div class="text-sm font-bold text-red-800 ml-1 uppercase">beta</div>
            </div>
            <div class="bg-gray-100 rounded p-2">
              <div class="flex flex-wrap text-gray-600 text-md font-bold">
                Register a parent or guardian account for ROAR Research Portal
              </div>
              <div class="flex flex-wrap text-gray-400 text-sm">
                This account allows your family to participate in ROAR research studies!
              </div>
              <div class="flex flex-wrap text-gray-400 text-sm">
                After registration, you can add children from your dashboard.
              </div>
            </div>
          </div>
        </div>
      </header>
      <div>
        <div v-if="spinner === false">
          <Register :code="code" @submit="handleSubmit($event)" />
        </div>
        <div v-else class="loading-container flex flex-column text-center justify-content-center align-content-center">
          <AppSpinner style="margin-bottom: 1rem" />
          <span class="text-center">Creating Family</span>
        </div>
        <PvDialog
          v-model:visible="isDialogVisible"
          :header="dialogHeader"
          :style="{ width: '25rem' }"
          :modal="true"
          :draggable="false"
        >
          <p>{{ dialogMessage }}</p>
          <PvButton @click="closeDialog">Close</PvButton>
        </PvDialog>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import { useFamilyRegistration } from '@/containers/FamilyRegistration/composables/useFamilyRegistration';
import Register from '../components/auth/RegisterParent.vue';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';

defineProps({
  code: { type: String, default: null },
});

const { submit: submitRegistration } = useFamilyRegistration();

const spinner = ref(false);
const dialogHeader = ref('');
const dialogMessage = ref('');
const isDialogVisible = ref(false);
// Handle for the pending post-success redirect timer so it can be cancelled if
// the user dismisses the success dialog before the auto-redirect fires.
const redirectTimeout = ref(null);

const showDialog = () => {
  isDialogVisible.value = true;
};

const closeDialog = () => {
  isDialogVisible.value = false;
  // Cancel the pending auto-redirect if the user closes the dialog first.
  if (redirectTimeout.value !== null) {
    clearTimeout(redirectTimeout.value);
    redirectTimeout.value = null;
  }
};

async function handleParentSubmit(data) {
  try {
    spinner.value = true;

    // Run the registration saga: create family → sign in. No agreement work is
    // done here — terms-of-service acceptance is handled post-login by the
    // `/me.unsignedAgreements` gate, and consent/assent are per-administration
    // and handled by the post-auth consent gate.
    await submitRegistration({
      email: data.ParentEmail,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    spinner.value = false;
    dialogHeader.value = 'Success!';
    dialogMessage.value = 'Your account has been created! Redirecting to your dashboard...';
    isDialogVisible.value = true;

    // Use a full page reload to ensure auth state is properly initialized
    // This is more reliable than router.push for post-authentication redirects.
    // Keep the handle so closeDialog can cancel it if the user dismisses first.
    redirectTimeout.value = setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  } catch (error) {
    spinner.value = false;
    dialogHeader.value = 'Error!';
    dialogMessage.value = error.message;
    showDialog();
  }
}

function handleSubmit(event) {
  // Only handle parent registration now. Return the promise so callers/tests can
  // await completion and so a synchronous throw isn't silently swallowed (an
  // `async` wrapper that doesn't await/return the call would drop both).
  return handleParentSubmit(event);
}

onMounted(async () => {
  document.body.classList.add('page-register');
});

onBeforeUnmount(() => {
  document.body.classList.remove('page-register');
  // Cancel any pending redirect so it can't fire after the component is gone.
  if (redirectTimeout.value !== null) {
    clearTimeout(redirectTimeout.value);
    redirectTimeout.value = null;
  }
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

.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
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
