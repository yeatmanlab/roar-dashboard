<template>
  <div class="self-registration-form-content">
    <form ref="formElement" class="self-registration-form p-fluid" novalidate @submit.prevent="handleSubmit">
      <div class="self-registration-name-fields">
        <TextInput
          id="account-owner-first-name"
          :label="t('pageRegister.firstName')"
          name="firstName"
          autocomplete="given-name"
          required
          :disabled="disabled"
          :placeholder="t('pageRegister.firstNamePlaceholder')"
          :model-value="values.firstName"
          :invalid="showError('firstName')"
          :error="showError('firstName') ? errors.firstName : ''"
          data-cy="signup__parent-first-name"
          @update:model-value="updateField('firstName', $event)"
          @blur="$emit('touch', 'firstName')"
        />

        <TextInput
          id="account-owner-last-name"
          :label="t('pageRegister.lastName')"
          name="lastName"
          autocomplete="family-name"
          required
          :disabled="disabled"
          :placeholder="t('pageRegister.lastNamePlaceholder')"
          :model-value="values.lastName"
          :invalid="showError('lastName')"
          :error="showError('lastName') ? errors.lastName : ''"
          data-cy="signup__parent-last-name"
          @update:model-value="updateField('lastName', $event)"
          @blur="$emit('touch', 'lastName')"
        />
      </div>

      <TextInput
        id="account-owner-email"
        :label="t('pageRegister.email')"
        name="email"
        type="email"
        inputmode="email"
        autocomplete="email"
        required
        :disabled="disabled"
        :placeholder="t('pageRegister.emailPlaceholder')"
        :model-value="values.email"
        :invalid="showError('email')"
        :error="showError('email') ? errors.email : ''"
        data-cy="signup__parent-email"
        @update:model-value="updateField('email', $event)"
        @blur="$emit('touch', 'email')"
      />

      <PasswordInput
        id="account-owner-password"
        :label="t('pageRegister.password')"
        name="password"
        autocomplete="new-password"
        required
        :disabled="disabled"
        :placeholder="t('pageRegister.passwordPlaceholder')"
        :help="t('pageRegister.passwordHelp')"
        :show-password-label="t('pageRegister.showPassword')"
        :hide-password-label="t('pageRegister.hidePassword')"
        :model-value="values.password"
        :invalid="showError('password')"
        :error="showError('password') ? errors.password : ''"
        data-cy="signup__parent-password"
        @update:model-value="updateField('password', $event)"
        @blur="$emit('touch', 'password')"
      />

      <ChallengeV3 :model-value="verificationToken" action="submit" @update:model-value="$emit('verification', $event)">
        <div class="self-registration-acknowledgements">
          <CheckboxInput
            id="account-owner-future-contact"
            name="futureContact"
            :label="t('pageRegister.futureContact')"
            :disabled="disabled"
            :model-value="futureContactAllowed"
            @update:model-value="$emit('update:future-contact-allowed', $event)"
          />

          <CheckboxInput
            id="account-owner-legal-acceptance"
            name="legalAcceptance"
            required
            :disabled="disabled"
            :model-value="legalAccepted"
            :invalid="submitted && !legalAccepted"
            :error="submitted && !legalAccepted ? t('pageRegister.reviewTerms') : ''"
            @update:model-value="$emit('update:legal-accepted', $event)"
          >
            <span>
              {{ t('pageRegister.agreeToTerms') }}
              <a
                class="self-registration-terms-link"
                :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('pageRegister.termsOfUse') }}
              </a>
            </span>
          </CheckboxInput>
        </div>
      </ChallengeV3>

      <PvButton
        type="submit"
        :label="submitting ? t('pageRegister.creatingAccount') : t('pageRegister.createAccount')"
        class="self-registration-submit"
        :disabled="disabled"
        :loading="submitting"
        data-cy="signup__create-account"
      />
    </form>

    <div class="self-registration-sign-in">
      <span>{{ t('pageRegister.alreadyHaveAccount') }}</span>
      <RouterLink :to="APP_ROUTES.SIGN_IN">{{ t('pageRegister.signIn') }}</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ChallengeV3 } from 'vue-recaptcha';
import PvButton from 'primevue/button';
import CheckboxInput from '@/components/Form/CheckboxInput';
import PasswordInput from '@/components/Form/PasswordInput';
import TextInput from '@/components/Form/TextInput';
import { TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';
import { i18n } from '@/translations/i18n';

const props = defineProps({
  values: { type: Object, required: true },
  errors: { type: Object, required: true },
  touched: { type: Object, required: true },
  submitted: { type: Boolean, default: false },
  legalAccepted: { type: Boolean, default: false },
  futureContactAllowed: { type: Boolean, default: false },
  verificationToken: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits([
  'submit',
  'touch',
  'update:field',
  'update:legal-accepted',
  'update:future-contact-allowed',
  'verification',
]);

const { t } = i18n.global;
const formElement = ref(null);

function updateField(field, value) {
  emit('update:field', field, value);
}

function showError(field) {
  return Boolean(props.errors[field] && (props.submitted || props.touched[field]));
}

async function handleSubmit() {
  emit('submit');
  await nextTick();
  formElement.value?.querySelector('[aria-invalid="true"]')?.focus();
}
</script>

<style scoped>
.self-registration-form-content {
  width: 100%;
}

.self-registration-form {
  display: grid;
  gap: 1.25rem;
}

.self-registration-name-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.self-registration-acknowledgements {
  display: grid;
  gap: 0.875rem;
}

.self-registration-terms-link {
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.self-registration-submit {
  width: 100%;
}

.self-registration-sign-in {
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  margin-top: 1.25rem;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

@media (max-width: 36rem) {
  .self-registration-name-fields {
    grid-template-columns: 1fr;
  }
}
</style>
