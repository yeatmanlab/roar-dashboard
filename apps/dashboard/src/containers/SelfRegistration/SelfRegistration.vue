<template>
  <div id="register-container" class="self-registration">
    <section id="register" class="self-registration-form-card" aria-labelledby="self-registration-heading">
      <header class="self-registration-header">
        <div class="self-registration-logo" role="img" aria-label="ROAR">
          <ROARLogoShort aria-hidden="true" />
        </div>
        <div class="self-registration-heading">
          <h1 id="self-registration-heading">Create your account</h1>
          <p>Sign up to start ROARing</p>
        </div>
      </header>

      <RegistrationStatus
        :loading="registration.isSubmitting.value"
        :error-message="registration.errorMessage.value"
        :success="registration.isSuccess.value"
        @dismiss="registration.dismissStatus"
      />
      <AccountOwnerForm
        v-if="!registration.isSubmitting.value && !registration.isSuccess.value"
        :values="form.values"
        :errors="form.errors.value"
        :touched="form.touched"
        :submitted="form.submitted.value"
        :legal-accepted="consent.legalAccepted.value"
        :future-contact-allowed="consent.futureContactAllowed.value"
        :verification-token="registration.verificationToken.value"
        :disabled="isSubmitDisabled"
        :submitting="registration.isSubmitting.value"
        @update:field="form.setField"
        @touch="form.touch"
        @update:legal-accepted="consent.setLegalAccepted"
        @update:future-contact-allowed="consent.setFutureContactAllowed"
        @verification="registration.setVerificationToken"
        @submit="handleSubmit"
      />
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { AccountOwnerForm, RegistrationStatus } from './components';
import { useAccountOwnerForm } from './composables/useAccountOwnerForm';
import { useResearchConsent } from './composables/useResearchConsent';
import { useSelfRegistration } from './composables/useSelfRegistration';

const form = useAccountOwnerForm();
const consent = useResearchConsent();
const registration = useSelfRegistration();

// Field and legal validity stay out of the disabled state so an attempted
// submission can reveal actionable inline errors. Verification readiness stays
// in the disabled state because submitting without a token cannot proceed.
const isSubmitDisabled = computed(() => !registration.verificationToken.value || registration.isSubmitting.value);

const canAttemptSubmission = computed(
  () =>
    consent.legalAccepted.value && Boolean(registration.verificationToken.value) && !registration.isSubmitting.value,
);

async function handleSubmit() {
  if (!form.validate()) return false;
  if (!canAttemptSubmission.value) return false;
  return registration.submit(form.payload.value);
}

onMounted(() => document.body.classList.add('page-register'));
onBeforeUnmount(() => document.body.classList.remove('page-register'));
</script>

<style scoped>
.self-registration {
  isolation: isolate;
}

.self-registration-form-card {
  width: 100%;
  padding: 2.25rem;
  border: 1px solid var(--surface-200);
  border-radius: 0.75rem;
  background: var(--surface-0);
  box-shadow: 0 1px 3px rgb(15 23 42 / 8%);
}

.self-registration-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.75rem;
  text-align: center;
}

.self-registration-logo {
  width: 5rem;
  color: var(--primary-color);
}

.self-registration-logo :deep(path) {
  fill: currentColor;
}

.self-registration-heading {
  display: grid;
  gap: 0.5rem;
}

.self-registration-heading h1,
.self-registration-heading p {
  margin: 0;
}

.self-registration-heading h1 {
  color: var(--text-color);
  font-size: 2rem;
  font-weight: 400;
  line-height: 1.2;
}

.self-registration-heading p {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

@media (max-width: 36rem) {
  .self-registration-form-card {
    padding: 1.75rem;
  }
}

@media (max-width: 22rem) {
  .self-registration-form-card {
    padding: 1.25rem;
  }
}
</style>
