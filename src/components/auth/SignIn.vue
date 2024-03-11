<template>
  <div class="card">
    <form class="p-fluid" @submit.prevent="handleFormSubmit(!v$.$invalid)">
      <div class="field mt-2">
        <div class="p-input-icon-right">
          <PvInputText
            :id="$t('authSignIn.emailId')"
            v-model="v$.email.$model"
            :class="{ 'p-invalid': invalid }"
            aria-describedby="email-error"
            :placeholder="$t('authSignIn.emailPlaceholder')"
            data-cy="input-username-email"
          />
        </div>
        <small v-if="invalid" class="p-error">{{ $t('authSignIn.incorrectEmailOrPassword') }}</small>
      </div>
      <div class="field mt-4 mb-5">
        <div>
          <span v-if="evaluatingEmail">
            <PvSkeleton height="2.75rem" />
          </span>
          <div v-else-if="allowPassword && allowLink">{{ $t('authSignIn.bothAllowed') }}</div>
          <PvPassword
            v-else-if="allowPassword"
            :id="$t('authSignIn.passwordId')"
            v-model="v$.password.$model"
            :class="{ 'p-invalid': invalid }"
            toggle-mask
            show-icon="pi pi-eye-slash"
            hide-icon="pi pi-eye"
            :feedback="false"
            :placeholder="$t('authSignIn.passwordPlaceholder')"
            data-cy="input-password"
          >
            <template #header>
              <h6>{{ $t('authSignIn.pickPassword') }}</h6>
            </template>
            <template #footer="sp">
              {{ sp.level }}
              <PvDivider />
              <p class="mt-2">{{ $t('authSignIn.suggestions') }}</p>
              <ul class="pl-2 ml-2 mt-0" style="line-height: 1.5">
                <li>{{ $t('authSignIn.atLeastOneLowercase') }}</li>
                <li>{{ $t('authSignIn.atLeastOneUppercase') }}</li>
                <li>{{ $t('authSignIn.atLeastOneNumeric') }}</li>
                <li>{{ $t('authSignIn.minimumCharacters') }}</li>
              </ul>
            </template>
          </PvPassword>
          <div v-else-if="allowLink">
            <PvPassword disabled :placeholder="$t('authSignIn.signInWithEmailLinkPlaceHolder')" />
          </div>
          <div v-else>
            <PvPassword
              disabled
              class="p-invalid text-red-600"
              :placeholder="$t('authSignIn.invalidEmailPlaceholder')"
            />
          </div>
        </div>
      </div>
      <PvButton type="submit" :label="$t('authSignIn.buttonLabel') + ' &rarr;'" class="submit-button" />
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { required, requiredUnless } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import _debounce from 'lodash/debounce';
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const emit = defineEmits(['submit']);
// eslint-disable-next-line no-unused-vars
const props = defineProps({
  invalid: { type: Boolean, required: false, default: false },
});

const state = reactive({
  email: '',
  password: '',
  useLink: false,
});

const rules = {
  email: { required },
  password: {
    requiredIf: requiredUnless(() => state.useLink),
  },
};
const submitted = ref(false);
const v$ = useVuelidate(rules, state);

const handleFormSubmit = (isFormValid) => {
  submitted.value = true;
  if (!isFormValid) {
    return;
  }
  emit('submit', state);
};

const isValidEmail = (email) => {
  var re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

const evaluatingEmail = ref(false);
const allowPassword = ref(true);
const allowLink = ref(false);

const validateRoarEmail = _debounce(
  async (email) => {
    await roarfirekit.value.isEmailAvailable(email).then(async (emailAvail) => {
      if (email.includes('levante')) {
        allowLink.value = false;
        allowPassword.value = true;
        state.useLink = allowLink.value;
        evaluatingEmail.value = false;
        return;
      }

      if (emailAvail) {
        console.log(`Email ${email} is available`);
        allowPassword.value = false;
        allowLink.value = false;
      } else {
        if (roarfirekit.value.isRoarAuthEmail(email)) {
          // Roar auth email are made up, so sign-in link is not allowed.
          allowLink.value = false;
          allowPassword.value = true;
        } else {
          allowLink.value = true;
          allowPassword.value = false;
        }
      }
      state.useLink = allowLink.value;
      evaluatingEmail.value = false;
    });
  },
  250,
  { maxWait: 1000 },
);

watch(
  () => state.email,
  async (email) => {
    if (isValidEmail(email)) {
      evaluatingEmail.value = true;
      validateRoarEmail(email);
    } else {
      // In this case, assume that the input is a username
      // Password is allowed. Sign-in link is not allowed.
      allowPassword.value = true;
      allowLink.value = false;
      state.useLink = allowLink.value;
    }
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
</style>
