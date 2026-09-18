<template>
  <div class="self-registration-form-card">
    <form class="self-registration-form p-fluid" novalidate @submit.prevent="$emit('submit')">
      <p class="self-registration-required-hint"><span aria-hidden="true">*</span> Required fields</p>

      <div class="self-registration-name-fields">
        <TextInput
          id="account-owner-first-name"
          label="First name"
          name="firstName"
          autocomplete="given-name"
          required
          :model-value="values.firstName"
          :invalid="showError('firstName')"
          :error="showError('firstName') ? errors.firstName : ''"
          data-cy="signup__parent-first-name"
          @update:model-value="updateField('firstName', $event)"
          @blur="$emit('touch', 'firstName')"
        />

        <TextInput
          id="account-owner-last-name"
          label="Last name"
          name="lastName"
          autocomplete="family-name"
          required
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
        label="Email address"
        name="email"
        type="email"
        inputmode="email"
        autocomplete="email"
        required
        :model-value="values.email"
        :invalid="showError('email')"
        :error="showError('email') ? errors.email : ''"
        data-cy="signup__parent-email"
        @update:model-value="updateField('email', $event)"
        @blur="$emit('touch', 'email')"
      />

      <PasswordInput
        id="account-owner-password"
        label="Password"
        name="password"
        autocomplete="new-password"
        required
        help="Use at least 8 characters."
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
            id="account-owner-legal-acceptance"
            name="legalAcceptance"
            required
            :model-value="legalAccepted"
            :invalid="submitted && !legalAccepted"
            :error="submitted && !legalAccepted ? 'Review and accept the Terms of Use.' : ''"
            @update:model-value="$emit('update:legal-accepted', $event)"
          >
            <span>
              I agree to the
              <a
                class="self-registration-terms-link"
                :href="TERMS_OF_SERVICE_DOCUMENT_PATH"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Use
              </a>
            </span>
          </CheckboxInput>

          <CheckboxInput
            id="account-owner-future-contact"
            name="futureContact"
            label="Contact me about future research opportunities (optional)"
            :model-value="futureContactAllowed"
            @update:model-value="$emit('update:future-contact-allowed', $event)"
          />
        </div>
      </ChallengeV3>

      <PvButton
        type="submit"
        label="Create account"
        class="self-registration-submit"
        :disabled="disabled"
        :loading="submitting"
        data-cy="signup__create-account"
      />
    </form>

    <div class="self-registration-sign-in">
      <span>Already have an account?</span>
      <RouterLink :to="APP_ROUTES.SIGN_IN">Sign in</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import { ChallengeV3 } from 'vue-recaptcha';
import PvButton from 'primevue/button';
import CheckboxInput from '@/components/Form/CheckboxInput';
import PasswordInput from '@/components/Form/PasswordInput';
import TextInput from '@/components/Form/TextInput';
import { TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';

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

function updateField(field, value) {
  emit('update:field', field, value);
}

function showError(field) {
  return Boolean(props.errors[field] && (props.submitted || props.touched[field]));
}
</script>

<style scoped>
.self-registration-form-card {
  overflow: hidden;
  border: 1px solid var(--surface-200);
  border-radius: 0.75rem;
  background: var(--surface-0);
  box-shadow: 0 0.125rem 0.5rem rgb(0 0 0 / 8%);
}

.self-registration-form {
  display: grid;
  gap: 1.25rem;
  padding: 1.5rem;
}

.self-registration-required-hint {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.self-registration-name-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.self-registration-required-hint span {
  color: var(--bright-red);
}

.self-registration-acknowledgements {
  display: grid;
  gap: 1rem;
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
  padding: 1rem;
  border-top: 1px solid var(--surface-200);
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

@media (max-width: 36rem) {
  .self-registration-name-fields {
    grid-template-columns: 1fr;
  }

  .self-registration-form {
    padding: 1.25rem;
  }
}
</style>
