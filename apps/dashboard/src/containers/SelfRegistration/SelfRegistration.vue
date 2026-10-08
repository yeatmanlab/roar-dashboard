<template>
  <div id="register-container" class="self-registration">
    <div class="self-registration-column">
      <section id="register" class="self-registration-form-card" aria-labelledby="self-registration-heading">
        <header class="self-registration-header">
          <div class="self-registration-logo" role="img" aria-label="ROAR">
            <ROARLogoShort aria-hidden="true" />
          </div>
          <div class="self-registration-heading">
            <h1 id="self-registration-heading">{{ t('pageRegister.title') }}</h1>
            <p>{{ t('pageRegister.subtitle') }}</p>
          </div>
        </header>

        <PvDialog
          :visible="Boolean(registration.errorMessage.value)"
          :header="t('pageRegister.createErrorTitle')"
          :style="{ width: 'min(25rem, calc(100vw - 2rem))' }"
          :modal="true"
          :draggable="false"
          @update:visible="registration.dismissError"
        >
          <p role="alert">{{ registration.errorMessage.value }}</p>
          <PvButton :label="t('pageRegister.close')" @click="registration.dismissError" />
        </PvDialog>
        <AccountOwnerForm
          :values="form.values"
          :errors="form.errors.value"
          :touched="form.touched"
          :submitted="form.submitted.value"
          :legal-accepted="consent.legalAccepted.value"
          :future-contact-allowed="consent.futureContactAllowed.value"
          :verification-token="registration.verificationToken.value"
          :disabled="!canAttemptSubmission"
          :submitting="registration.isSubmitting.value"
          @update:field="form.setField"
          @touch="form.touch"
          @update:legal-accepted="consent.setLegalAccepted"
          @update:future-contact-allowed="consent.setFutureContactAllowed"
          @verification="registration.setVerificationToken"
          @submit="handleSubmit"
        />
      </section>
      <AuthPageFooter />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import AuthPageFooter from '@/components/AuthPageFooter.vue';
import { i18n } from '@/translations/i18n';
import { AccountOwnerForm } from './components';
import { useAccountOwnerForm } from './composables/useAccountOwnerForm';
import { useResearchConsent } from './composables/useResearchConsent';
import { useSelfRegistration } from './composables/useSelfRegistration';

const { t } = i18n.global;
const form = useAccountOwnerForm({ t });
const consent = useResearchConsent();
const registration = useSelfRegistration({ t });

// Keep the button available so submission can reveal actionable field and
// acknowledgement errors. Disable it only while a request is in flight.
const canAttemptSubmission = computed(() => !registration.isSubmitting.value);

async function handleSubmit() {
  if (!form.validate()) return false;
  // Form validation marks the form submitted, which makes the legal
  // acknowledgement error visible before this guard prevents the request.
  if (!consent.legalAccepted.value) return false;
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

.self-registration-column {
  width: 100%;
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
