<template>
  <!-- <PvToast /> -->
  <div class="card">
    <form class="p-fluid" @submit.prevent="handleFormSubmit(!v$.$invalid)">
      <div class="mt-1 field">
        <div class="p-input-icon-right">
          <PvFloatLabel v-if="!showPasswordField" class="mt-4">
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
          <div v-else class="w-full flex justify-content-center align-items-center mb-8 mt-0 pt-0">
            <PvChip
              :label="v$.email.$model"
              class="flex justify-content-center align-items-center"
              image="/src/assets/cute-lion.png"
              removable
              @remove="handleChipRemove"
            />
          </div>
          <PvMessage v-if="invalid" icon="pi pi-times-circle" class="text-red-500" severity="error">{{
            $t('authSignIn.incorrectEmailOrPassword')
          }}</PvMessage>
        </div>
      </div>
      <div v-if="showPassword" class="mt-2 mb-1 field">
        <div>
          <!-- Email is entered, Password is desired -->
          <div v-if="showPassword">
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
            <div class="flex justify-content-start w-full">
              <small class="text-link text-sm text-400 sign-in-method-link" @click="handleForgotPassword">{{
                $t('authSignIn.forgotPassword')
              }}</small>
            </div>
          </div>
          <PvInputGroup v-else>
            <!-- Username is entered, Password is desired -->
            <PvPassword
              :id="$t('authSignIn.passwordId')"
              v-model="v$.password.$model"
              :class="['w-full', { 'p-invalid': invalid }]"
              toggle-mask
              :feedback="false"
              :placeholder="$t('authSignIn.passwordPlaceholder')"
              data-cy="sign-in__password"
              @keyup="checkForCapsLock"
              @click="checkForCapsLock"
            >
              <template #header>
                <h6>{{ $t('authSignIn.pickPassword') }}</h6>
              </template>
              <template #footer="sp">
                {{ sp.level }}
                <PvDivider />
                <p class="mt-2">{{ $t('authSignIn.suggestions') }}</p>
                <ul class="pl-2 mt-0 ml-2" style="line-height: 1.5">
                  <li>{{ $t('authSignIn.atLeastOneLowercase') }}</li>
                  <li>{{ $t('authSignIn.atLeastOneUppercase') }}</li>
                  <li>{{ $t('authSignIn.atLeastOneNumeric') }}</li>
                  <li>{{ $t('authSignIn.minimumCharacters') }}</li>
                </ul>
              </template>
            </PvPassword>
            <PvInputGroupAddon>
              <PvButton
                type="submit"
                class="bg-white border-none text-primary p-0 hover:bg-primary hover:text-white p-2"
                icon="pi pi-arrow-right"
                data-cy="sign-in__submit"
              />
            </PvInputGroupAddon>
          </PvInputGroup>
          <div v-if="capsLockEnabled" class="mt-2 p-error">⇪ Caps Lock is on!</div>
        </div>
      </div>
      <PvButton
        type="button"
        class="mt-3 w-full p-0 hover:surface-200 hover:text-primary p-2"
        @click="!showPasswordField ? emit('check-providers', state.email) : emit('submit', state)"
      >
        <span>Continue</span>
      </PvButton>
      <div v-if="!showPasswordField" class="divider w-full">
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
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import PvPassword from 'primevue/password';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputGroup from 'primevue/inputgroup';
import PvInputGroupAddon from 'primevue/inputgroupaddon';
import PvDivider from 'primevue/divider';
import PvChip from 'primevue/chip';
import PvMessage from 'primevue/message';
import { useAuthStore } from '@/store/auth';
import RoarModal from '../modals/RoarModal.vue';

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const emit = defineEmits(['submit', 'update:email', 'update:showPasswordField', 'check-providers', 'reset']);

const showPassword = ref(false); // single source of truth for template

const props = defineProps({
  invalid: { type: Boolean, required: false, default: false },
  showPasswordField: { type: Boolean, required: false, default: false },
});

function handleChipRemove() {
  // reset child-local state
  state.email = '';
  state.password = '';
  submitted.value = false;
  capsLockEnabled.value = false;
  v$?.value?.$reset?.();

  // sync parent state via emits
  emit('update:email', '');
  emit('update:showPasswordField', false);

  // tell the parent to reset its own UI state
  emit('reset');
}

const state = reactive({
  email: '',
  password: '',
});

watch(
  () => props.showPasswordField,
  (v) => {
    showPassword.value = !!v;
  },
  { immediate: true },
);

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
// const showPasswordField = ref(false);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;
  if (!isFormValid) {
    return;
  }
  emit('submit', state);
};

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
  },
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
