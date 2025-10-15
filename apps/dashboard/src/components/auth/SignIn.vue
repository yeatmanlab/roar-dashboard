<template>
  <!-- <PvToast /> -->
  <div class="card">
    <form class="p-fluid" @submit.prevent="handleFormSubmit(!v$.$invalid)">
      <div class="mt-1 field">
        <div class="p-input-icon-right mt-4">
          <PvFloatLabel>
            <PvInputText
              :id="$t('authSignIn.emailId')"
              v-model="v$.email.$model"
              :class="['w-full', { 'p-invalid': invalid }]"
              aria-describedby="email-error"
              data-cy="sign-in__username"
              @keyup="checkForCapsLock"
              @click="checkForCapsLock"
            />
            <label for="email">{{ $t('authSignIn.emailPlaceholder') }}</label>
          </PvFloatLabel>
          <small v-if="invalid" class="p-error">{{ $t('authSignIn.incorrectEmailOrPassword') }}</small>
          <!-- <InputGroupAddon :style="{ 'visibility': showPasswordField ? 'hidden' : 'visible' }"></InputGroupAddon> -->
          <PvButton
            type="checkProviders"
            class="mt-3 w-full p-0 hover:surface-200 hover:text-primary p-2"
            @click="onShowPasswordClick"
          >
            <span>Continue</span>
          </PvButton>
        </div>
      </div>
      <div v-if="showPasswordField" class="mt-2 mb-3 field">
        <div>
          <!-- Email is entered, Password is desired -->
          <div v-if="showPasswordField">
            <PvPassword
              :id="$t('authSignIn.passwordId')"
              v-model="v$.password.$model"
              :class="['w-full', { 'p-invalid': invalid }]"
              :feedback="false"
              :placeholder="$t('authSignIn.passwordPlaceholder')"
              :input-props="{ autocomplete: 'current-password' }"
              toggle-mask
              show-icon="pi pi-eye-slash"
              hide-icon="pi pi-eye"
              data-cy="sign-in__password"
              @keyup="checkForCapsLock"
              @click="checkForCapsLock"
            />
            <div class="flex justify-content-end w-full">
              <small class="text-link sign-in-method-link" @click="handleForgotPassword">{{
                $t('authSignIn.forgotPassword')
              }}</small>
            </div>
          </div>
          <div v-if="capsLockEnabled" class="mt-2 p-error">⇪ Caps Lock is on!</div>
        </div>
      </div>
      <div class="divider w-full">
        <span class="text-md">{{ $t('authSignIn.or') }}</span>
      </div>
    </form>
  </div>
  <RoarModal
    :is-enabled="forgotPasswordModalOpen"
    title="Forgot Password"
    subtitle="Enter your email to reset your password"
    small
    @modal-closed="forgotPasswordModalOpen = false"
  >
    <template #default>
      <div class="flex flex-column">
        <label>Email</label>
        <PvInputText v-model="forgotEmail" />
      </div>
    </template>
    <template #footer>
      <PvButton
        tabindex="0"
        class="p-2 bg-white border-none border-round text-primary hover:surface-200"
        text
        label="Cancel"
        outlined
        @click="closeForgotPasswordModal"
      ></PvButton>
      <PvButton
        tabindex="0"
        class="p-2 text-white border-none border-round bg-primary hover:surface-400"
        label="Send Reset Email"
        @click="sendResetEmail"
      ></PvButton>
    </template>
  </RoarModal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { required, requiredUnless } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import _debounce from 'lodash/debounce';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import PvPassword from 'primevue/password';
import PvFloatLabel from 'primevue/floatlabel';
// import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import RoarModal from '../modals/RoarModal.vue';
// import PvToast from 'primevue/toast';
// import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts.js';

// // Enable the email-link button only when the email is valid, link flow allowed,
// // and we’re not currently checking the email.
// const canSendLink = computed(() => {
//   return isValidEmail(state.email) && !evaluatingEmail.value;
// });

// // Clicking the educator-only button submits in "magic link" mode immediately.
// function handleSignInWithEmailLink() {
//   emit('submit', state);
// }

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const emit = defineEmits(['submit', 'update:email', 'checkProviders']);
// eslint-disable-next-line no-unused-vars
const props = defineProps({
  invalid: { type: Boolean, required: false, default: false },
});

const state = reactive({
  email: '',
  password: '',
  role: 'student',
});

// const toast = useToast();

// function showInvalidEmail() {
//   console.log('Invalid email');
//   toast.add({
//     severity: TOAST_SEVERITIES.ERROR,
//     summary: 'Error',
//     detail: 'Invalid email',
//     life: TOAST_DEFAULT_LIFE_DURATION,
//   });
// }

const rules = {
  email: { required },
  password: {
    requiredIf: requiredUnless(() => state.role === 'educator'),
  },
};
const submitted = ref(false);
const v$ = useVuelidate(rules, state);
const capsLockEnabled = ref(false);
const forgotPasswordModalOpen = ref(false);
const showPasswordField = ref(false);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;
  if (!isFormValid) {
    return;
  }
  emit('submit', state);
};

// function allowSignInPassword() {
//   showPasswordField.value = true;
// }

const isValidEmail = (email) => {
  var re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

const evaluatingEmail = ref(false);

const validateRoarEmail = _debounce(
  async (email) => {
    await roarfirekit.value.isEmailAvailable(email).then(async (emailAvail) => {
      if (emailAvail) {
        console.log(`Email ${email} is available`);
      }
      evaluatingEmail.value = false;
    });
  },
  250,
  { maxWait: 1000 },
);

function checkForCapsLock(e) {
  // Make sure the event is a keyboard event.
  // Using password autofill will trigger a regular
  //   event which does not have a getModifierState method.
  if (e instanceof KeyboardEvent) {
    capsLockEnabled.value = e.getModifierState('CapsLock');
  }
}

const forgotEmail = ref('');
function handleForgotPassword() {
  console.log('Opening modal for forgot password');
  forgotPasswordModalOpen.value = true;
  // e.preventDefault();
}
function closeForgotPasswordModal() {
  forgotPasswordModalOpen.value = false;
  forgotEmail.value = '';
}
function sendResetEmail() {
  console.log('Submitting forgot password with email', forgotEmail.value);
  roarfirekit.value.sendPasswordResetEmail(forgotEmail.value);
  closeForgotPasswordModal();
}

watch(
  () => state.email,
  async (email) => {
    emit('update:email', email);
    if (isValidEmail(email)) {
      evaluatingEmail.value = true;
      validateRoarEmail(email);
    }
  },
);

// Reset the form when the role changes
function resetForRole(role) {
  if (role === 'student') {
    showPasswordField.value = false;
    state.password = '';
    capsLockEnabled.value = false;
    submitted.value = false;
    v$?.value?.$reset?.();
  } else if (role === 'educator') {
    showPasswordField.value = false;
    capsLockEnabled.value = false;
    submitted.value = false;
    v$?.value?.$reset?.();
  }
}

watch(
  () => state.role,
  (role) => resetForRole(role),
  { immediate: true },
);
</script>
<style scoped>
.submit-button {
  margin-top: 0.5rem;
  display: flex;
  background-color: #e5e5e5;
  color: black;
  border: none;
  width: 11.75rem;
}

.submit-button:hover {
  background-color: #b7b5b5;
  color: black;
}
.text-link {
  cursor: pointer;
  color: var(--text-color-secondary);
  font-weight: bold;
  text-decoration: underline;
  font-size: 1rem;
}

.text-link:hover {
  color: var(--primary-color-text);
}
.sign-in-method-link {
  margin-top: 0.5rem;
  display: flex;
}
.p-togglebutton {
  background: var(--primary-color) !important;
}
.p-togglebutton-content {
  background: var(--primary-color) !important;
}
.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #6b7280; /* Tailwind gray-500 */
  font-weight: 500;
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #d1d5db; /* Tailwind gray-300 */
  margin: 0 0.75rem;
}
:deep(.role-select .p-selectbutton .p-button.p-highlight) {
  border: 2px solid #ef4444 !important; /* red */
}
</style>
