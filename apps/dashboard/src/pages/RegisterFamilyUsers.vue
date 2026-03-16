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
          <Register :code="code" :consent="consent" @submit="handleSubmit($event)" />
          <div
            v-if="isSuperAdmin"
            class="flex flex-row justify-content-center align-content-center z-2 absolute ml-5"
            style="margin-top: -5rem; margin-bottom: 4rem"
          >
            <PvCheckbox :model-value="isTestData" :binary="true" name="isTestDatalabel" @change="updateState" />
            <label for="isTestDatalabel" class="ml-2">This is test data</label>
          </div>
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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import PvButton from 'primevue/button';
import PvCheckbox from 'primevue/checkbox';
import PvDialog from 'primevue/dialog';
import { useAuthStore } from '@/store/auth';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import Register from '../components/auth/RegisterParent.vue';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';

const authStore = useAuthStore();
const initialized = ref(false);
const spinner = ref(false);

const props = defineProps({
  code: { type: String, default: null },
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));

const isTestData = ref(false);
const dialogHeader = ref('');
const dialogMessage = ref('');
const isDialogVisible = ref(false);
const consentName = ref('consent-behavioral-eye-tracking');

const showDialog = () => {
  isDialogVisible.value = true;
};

const closeDialog = () => {
  isDialogVisible.value = false;
  // Don't redirect here - let the success handler do it
};

async function handleParentSubmit(data) {
  try {
    spinner.value = true;

    // Fetch consent document
    const consentDoc = await authStore.getLegalDoc(consentName.value);
    const consentData = {
      version: consentDoc.currentCommit,
      name: consentName.value,
    };

    const parentUserData = {
      name: {
        first: data.firstName,
        last: data.lastName,
      },
      canContactForFutureStudies: data.canContactForFutureStudies || false,
      invitationCodes: props.code ? [props.code] : [], // Now supported by CreateParentInput interface
    };

    // Create parent account only (no children)
    await authStore.createNewFamily(
      data.ParentEmail,
      data.password,
      parentUserData,
      [], // Empty array - no children yet
      consentData,
      isTestData.value,
    );

    // Now sign in the parent to establish their auth session
    await authStore.roarfirekit.logInWithEmailAndPassword({
      email: data.ParentEmail,
      password: data.password,
    });

    spinner.value = false;
    dialogHeader.value = 'Success!';
    dialogMessage.value = 'Your account has been created! Redirecting to your dashboard...';
    isDialogVisible.value = true;

    // Use a full page reload to ensure auth state is properly initialized
    // This is more reliable than router.push for post-authentication redirects
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  } catch (error) {
    spinner.value = false;
    dialogHeader.value = 'Error!';
    dialogMessage.value = error.message;
    showDialog();
  }
}

async function handleSubmit(event) {
  // Only handle parent registration now
  handleParentSubmit(event);
}

function updateState() {
  isTestData.value = !isTestData.value;
}

// Removed watcher - parent registration now happens immediately in handleParentSubmit

onMounted(async () => {
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
