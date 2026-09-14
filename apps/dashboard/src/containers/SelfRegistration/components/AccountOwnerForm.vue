<template>
  <div class="self-registration-form-card">
    <form class="self-registration-form p-fluid" novalidate @submit.prevent="$emit('submit')">
      <p class="self-registration-required-hint"><span aria-hidden="true">*</span> Required fields</p>

      <div class="self-registration-name-fields">
        <div class="self-registration-field">
          <label for="account-owner-first-name">First name <span aria-hidden="true">*</span></label>
          <PvInputText
            id="account-owner-first-name"
            name="firstName"
            autocomplete="given-name"
            :model-value="values.firstName"
            :invalid="showError('firstName')"
            :aria-invalid="showError('firstName')"
            :aria-describedby="showError('firstName') ? 'account-owner-first-name-error' : undefined"
            data-cy="signup__parent-first-name"
            @update:model-value="updateField('firstName', $event)"
            @blur="$emit('touch', 'firstName')"
          />
          <small v-if="showError('firstName')" id="account-owner-first-name-error" class="p-error">
            {{ errors.firstName }}
          </small>
        </div>

        <div class="self-registration-field">
          <label for="account-owner-last-name">Last name <span aria-hidden="true">*</span></label>
          <PvInputText
            id="account-owner-last-name"
            name="lastName"
            autocomplete="family-name"
            :model-value="values.lastName"
            :invalid="showError('lastName')"
            :aria-invalid="showError('lastName')"
            :aria-describedby="showError('lastName') ? 'account-owner-last-name-error' : undefined"
            data-cy="signup__parent-last-name"
            @update:model-value="updateField('lastName', $event)"
            @blur="$emit('touch', 'lastName')"
          />
          <small v-if="showError('lastName')" id="account-owner-last-name-error" class="p-error">
            {{ errors.lastName }}
          </small>
        </div>
      </div>

      <div class="self-registration-field">
        <label for="account-owner-email">Email address <span aria-hidden="true">*</span></label>
        <PvInputText
          id="account-owner-email"
          name="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          :model-value="values.email"
          :invalid="showError('email')"
          :aria-invalid="showError('email')"
          :aria-describedby="showError('email') ? 'account-owner-email-error' : undefined"
          data-cy="signup__parent-email"
          @update:model-value="updateField('email', $event)"
          @blur="$emit('touch', 'email')"
        />
        <small v-if="showError('email')" id="account-owner-email-error" class="p-error">
          {{ errors.email }}
        </small>
      </div>

      <div class="self-registration-field">
        <label for="account-owner-password">Password <span aria-hidden="true">*</span></label>
        <PvPassword
          input-id="account-owner-password"
          :model-value="values.password"
          :invalid="showError('password')"
          :feedback="false"
          toggle-mask
          fluid
          :input-props="{
            name: 'password',
            autocomplete: 'new-password',
            'aria-invalid': showError('password'),
            'aria-describedby': showError('password')
              ? 'account-owner-password-help account-owner-password-error'
              : 'account-owner-password-help',
          }"
          data-cy="signup__parent-password"
          @update:model-value="updateField('password', $event)"
          @blur="$emit('touch', 'password')"
        />
        <small id="account-owner-password-help" class="self-registration-field-help">Use at least 8 characters.</small>
        <small v-if="showError('password')" id="account-owner-password-error" class="p-error">
          {{ errors.password }}
        </small>
      </div>

      <ChallengeV3 :model-value="verificationToken" action="submit" @update:model-value="$emit('verification', $event)">
        <div class="self-registration-acknowledgements">
          <div class="self-registration-checkbox-row">
            <PvCheckbox
              input-id="account-owner-legal-acceptance"
              name="legalAcceptance"
              binary
              :model-value="legalAccepted"
              :invalid="submitted && !legalAccepted"
              @update:model-value="$emit('update:legal-accepted', $event)"
            />
            <label for="account-owner-legal-acceptance">
              I agree to the
              <a :href="TERMS_OF_SERVICE_DOCUMENT_PATH" target="_blank" rel="noopener noreferrer">Terms of Use</a>
              <span aria-hidden="true">*</span>
            </label>
          </div>
          <small v-if="submitted && !legalAccepted" class="p-error">Review and accept the Terms of Use.</small>

          <div class="self-registration-checkbox-row">
            <PvCheckbox
              input-id="account-owner-future-contact"
              name="futureContact"
              binary
              :model-value="futureContactAllowed"
              @update:model-value="$emit('update:future-contact-allowed', $event)"
            />
            <label for="account-owner-future-contact">
              Contact me about future research opportunities <span class="self-registration-optional">(optional)</span>
            </label>
          </div>
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
import PvCheckbox from 'primevue/checkbox';
import PvInputText from 'primevue/inputtext';
import PvPassword from 'primevue/password';
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

.self-registration-field {
  display: grid;
  gap: 0.375rem;
}

.self-registration-field label,
.self-registration-checkbox-row label {
  width: auto;
  color: var(--text-color);
  font-size: 0.875rem;
  font-weight: 600;
}

.self-registration-field label span,
.self-registration-required-hint span,
.self-registration-checkbox-row label > span:not(.self-registration-optional) {
  color: var(--bright-red);
}

.self-registration-field-help,
.self-registration-optional {
  color: var(--text-color-secondary);
  font-size: 0.8125rem;
  font-weight: 400;
}

.self-registration-acknowledgements {
  display: grid;
  gap: 1rem;
}

.self-registration-checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
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
