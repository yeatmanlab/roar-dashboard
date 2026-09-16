<template>
  <div class="self-registration-form-content">
    <form ref="formElement" class="self-registration-form" novalidate @submit.prevent="handleSubmit">
      <div class="self-registration-name-fields">
        <div class="self-registration-field">
          <label for="account-owner-first-name">
            {{ t('pageRegister.firstName') }} <span class="self-registration-required" aria-hidden="true">*</span>
            <span class="sr-only">({{ t('pageRegister.required') }})</span>
          </label>
          <input
            id="account-owner-first-name"
            class="self-registration-input"
            :class="{ 'self-registration-input--invalid': showError('firstName') }"
            name="firstName"
            required
            autocomplete="given-name"
            :placeholder="t('pageRegister.firstNamePlaceholder')"
            :value="values.firstName"
            :aria-invalid="showError('firstName')"
            :aria-describedby="showError('firstName') ? 'account-owner-first-name-error' : undefined"
            data-cy="signup__parent-first-name"
            @input="updateField('firstName', $event.target.value)"
            @blur="$emit('touch', 'firstName')"
          />
          <small v-if="showError('firstName')" id="account-owner-first-name-error" class="self-registration-error">
            {{ errors.firstName }}
          </small>
        </div>

        <div class="self-registration-field">
          <label for="account-owner-last-name">
            {{ t('pageRegister.lastName') }} <span class="self-registration-required" aria-hidden="true">*</span>
            <span class="sr-only">({{ t('pageRegister.required') }})</span>
          </label>
          <input
            id="account-owner-last-name"
            class="self-registration-input"
            :class="{ 'self-registration-input--invalid': showError('lastName') }"
            name="lastName"
            required
            autocomplete="family-name"
            :placeholder="t('pageRegister.lastNamePlaceholder')"
            :value="values.lastName"
            :aria-invalid="showError('lastName')"
            :aria-describedby="showError('lastName') ? 'account-owner-last-name-error' : undefined"
            data-cy="signup__parent-last-name"
            @input="updateField('lastName', $event.target.value)"
            @blur="$emit('touch', 'lastName')"
          />
          <small v-if="showError('lastName')" id="account-owner-last-name-error" class="self-registration-error">
            {{ errors.lastName }}
          </small>
        </div>
      </div>

      <div class="self-registration-field">
        <label for="account-owner-email">
          {{ t('pageRegister.email') }} <span class="self-registration-required" aria-hidden="true">*</span>
          <span class="sr-only">({{ t('pageRegister.required') }})</span>
        </label>
        <input
          id="account-owner-email"
          class="self-registration-input"
          :class="{ 'self-registration-input--invalid': showError('email') }"
          name="email"
          required
          type="email"
          inputmode="email"
          autocomplete="email"
          :placeholder="t('pageRegister.emailPlaceholder')"
          :value="values.email"
          :aria-invalid="showError('email')"
          :aria-describedby="showError('email') ? 'account-owner-email-error' : undefined"
          data-cy="signup__parent-email"
          @input="updateField('email', $event.target.value)"
          @blur="$emit('touch', 'email')"
        />
        <small v-if="showError('email')" id="account-owner-email-error" class="self-registration-error">
          {{ errors.email }}
        </small>
      </div>

      <div class="self-registration-field">
        <label for="account-owner-password">
          {{ t('pageRegister.password') }} <span class="self-registration-required" aria-hidden="true">*</span>
          <span class="sr-only">({{ t('pageRegister.required') }})</span>
        </label>
        <div class="self-registration-password">
          <input
            id="account-owner-password"
            class="self-registration-input self-registration-password-input"
            :class="{ 'self-registration-input--invalid': showError('password') }"
            name="password"
            required
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="new-password"
            :placeholder="t('pageRegister.passwordPlaceholder')"
            :value="values.password"
            :aria-invalid="showError('password')"
            :aria-describedby="passwordDescription"
            data-cy="signup__parent-password"
            @input="updateField('password', $event.target.value)"
            @blur="$emit('touch', 'password')"
          />
          <button
            type="button"
            class="self-registration-password-toggle"
            :aria-label="passwordVisible ? t('pageRegister.hidePassword') : t('pageRegister.showPassword')"
            :aria-pressed="passwordVisible"
            @click="passwordVisible = !passwordVisible"
          >
            <i :class="passwordVisible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
          </button>
        </div>
        <small id="account-owner-password-help" class="self-registration-field-help">
          {{ t('pageRegister.passwordHelp') }}
        </small>
        <small v-if="showError('password')" id="account-owner-password-error" class="self-registration-error">
          {{ errors.password }}
        </small>
      </div>

      <ChallengeV3 :model-value="verificationToken" action="submit" @update:model-value="$emit('verification', $event)">
        <div class="self-registration-acknowledgements">
          <div class="self-registration-checkbox-field">
            <div class="self-registration-checkbox-row">
              <input
                id="account-owner-future-contact"
                class="self-registration-checkbox"
                name="futureContact"
                type="checkbox"
                :checked="futureContactAllowed"
                @change="$emit('update:future-contact-allowed', $event.target.checked)"
              />
              <label for="account-owner-future-contact">{{ t('pageRegister.futureContact') }}</label>
            </div>
          </div>

          <div class="self-registration-checkbox-field">
            <div class="self-registration-checkbox-row">
              <input
                id="account-owner-legal-acceptance"
                class="self-registration-checkbox"
                name="legalAcceptance"
                required
                type="checkbox"
                :checked="legalAccepted"
                :aria-invalid="submitted && !legalAccepted"
                :aria-describedby="submitted && !legalAccepted ? 'account-owner-legal-error' : undefined"
                @click.prevent="toggleLegalAcceptance"
              />
              <label for="account-owner-legal-acceptance">
                {{ t('pageRegister.agreeToTerms') }}
                <a :href="TERMS_OF_SERVICE_DOCUMENT_PATH" target="_blank" rel="noopener noreferrer">
                  {{ t('pageRegister.termsOfUse') }}
                </a>
                <span class="self-registration-required" aria-hidden="true">*</span>
                <span class="sr-only">({{ t('pageRegister.required') }})</span>
              </label>
            </div>
            <small v-if="submitted && !legalAccepted" id="account-owner-legal-error" class="self-registration-error">
              {{ t('pageRegister.reviewTerms') }}
            </small>
          </div>
        </div>
      </ChallengeV3>

      <button
        type="submit"
        class="self-registration-submit"
        :disabled="disabled"
        :aria-busy="submitting"
        data-cy="signup__create-account"
      >
        <span v-if="submitting" class="pi pi-spin pi-spinner" aria-hidden="true" />
        {{ submitting ? t('pageRegister.creatingAccount') : t('pageRegister.createAccount') }}
      </button>
    </form>

    <p class="self-registration-sign-in">
      {{ t('pageRegister.alreadyHaveAccount') }}
      <RouterLink :to="APP_ROUTES.SIGN_IN">{{ t('pageRegister.signIn') }}</RouterLink>
    </p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ChallengeV3 } from 'vue-recaptcha';
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

const { t } = i18n.global;

const emit = defineEmits([
  'submit',
  'touch',
  'update:field',
  'update:legal-accepted',
  'update:future-contact-allowed',
  'verification',
]);

const formElement = ref(null);
const passwordVisible = ref(false);
const passwordDescription = computed(() =>
  showError('password') ? 'account-owner-password-help account-owner-password-error' : 'account-owner-password-help',
);

function updateField(field, value) {
  emit('update:field', field, value);
}

function toggleLegalAcceptance() {
  emit('update:legal-accepted', !props.legalAccepted);
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

.self-registration-field,
.self-registration-checkbox-field {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
}

.self-registration-field label,
.self-registration-checkbox-row label {
  width: auto;
  color: var(--text-color);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.35;
}

.self-registration-required,
.self-registration-error {
  color: var(--bright-red);
}

.self-registration-input {
  box-sizing: border-box;
  width: 100%;
  height: 3rem;
  padding: 0 0.875rem;
  border: 1px solid var(--surface-300);
  border-radius: 0.375rem;
  outline: none;
  background: var(--surface-0);
  color: var(--text-color);
  font: inherit;
  font-size: 0.9375rem;
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.self-registration-input::placeholder {
  color: var(--text-color-secondary);
  opacity: 0.65;
}

.self-registration-input:focus-visible,
.self-registration-password-toggle:focus-visible,
.self-registration-submit:focus-visible,
.self-registration-sign-in a:focus-visible,
.self-registration-checkbox:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  outline-offset: 2px;
}

.self-registration-input:focus-visible {
  border-color: var(--primary-color);
}

.self-registration-input--invalid {
  border-color: var(--bright-red);
}

.self-registration-password {
  position: relative;
}

.self-registration-password-input {
  padding-right: 3rem;
}

.self-registration-password-toggle {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  transform: translateY(-50%);
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text-color-secondary);
  cursor: pointer;
}

.self-registration-field-help,
.self-registration-error {
  font-size: 0.75rem;
  line-height: 1.35;
}

.self-registration-field-help {
  color: var(--text-color-secondary);
}

.self-registration-acknowledgements {
  display: grid;
  gap: 0.875rem;
}

.self-registration-checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.self-registration-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 auto;
  margin: 0;
  accent-color: var(--primary-color);
}

.self-registration-checkbox-row a,
.self-registration-sign-in a {
  color: var(--primary-color);
  font-weight: 500;
}

.self-registration-submit {
  display: inline-flex;
  width: 100%;
  height: 3rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 0.5rem;
  background: var(--primary-color);
  color: #fff;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: filter 150ms ease;
}

.self-registration-submit:hover:not(:disabled) {
  filter: brightness(0.9);
}

.self-registration-submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.self-registration-sign-in {
  margin: 1.25rem 0 0;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  text-align: center;
}

@media (max-width: 36rem) {
  .self-registration-name-fields {
    grid-template-columns: 1fr;
  }
}
</style>
