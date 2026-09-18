<template>
  <div id="register-container" class="self-registration">
    <div class="self-registration-column">
      <section
        id="register"
        class="self-registration-form-card"
        :aria-labelledby="
          registration.isSuccess.value ? 'self-registration-success-heading' : 'self-registration-heading'
        "
      >
        <header v-if="!registration.isSuccess.value" class="self-registration-header">
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
        <RegistrationSuccess v-if="registration.isSuccess.value" :first-name="form.values.firstName" />
        <AccountOwnerForm
          v-else
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
          @update:legal-accepted="handleLegalAccepted"
          @update:future-contact-allowed="consent.setFutureContactAllowed"
          @verification="registration.setVerificationToken"
          @submit="handleSubmit"
        />
      </section>
      <AuthPageFooter />
    </div>

    <ConsentModal
      :visible="consent.isModalOpen.value"
      :document="consent.consentDocument.value"
      :loading="consent.isLoading.value"
      :load-failed="Boolean(consent.loadError.value)"
      @cancel="consent.closeModal"
      @retry="loadResearchConsent"
      @confirm="confirmResearchConsent"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import AuthPageFooter from '@/components/AuthPageFooter.vue';
import { useAuthStore } from '@/store/auth';
import { i18n } from '@/translations/i18n';
import { AccountOwnerForm, ConsentModal, RegistrationSuccess } from './components';
import { loadDefaultResearchConsent } from './composables/loadDefaultResearchConsent';
import { useAccountOwnerForm } from './composables/useAccountOwnerForm';
import { useResearchConsent } from './composables/useResearchConsent';
import { useSelfRegistration } from './composables/useSelfRegistration';

const { t } = i18n.global;
const authStore = useAuthStore();
const form = useAccountOwnerForm({ t });
const consent = useResearchConsent();
const registration = useSelfRegistration({ t });

// Keep the button available so submission can reveal actionable field and
// acknowledgement errors. Disable it only while a request is in flight.
const canAttemptSubmission = computed(() => !registration.isSubmitting.value);

async function loadResearchConsent() {
  try {
    await consent.loadConsent(() =>
      loadDefaultResearchConsent(authStore.getLegalDoc.bind(authStore), i18n.global.locale.value),
    );
  } catch {
    // The composable exposes a recoverable error state; do not leak provider errors.
  }
}

function openResearchConsent() {
  consent.openModal();
  if (!consent.consentDocument.value && !consent.isLoading.value) void loadResearchConsent();
}

function handleLegalAccepted(value) {
  if (!value) {
    consent.setLegalAccepted(false);
    return;
  }

  openResearchConsent();
}

function confirmResearchConsent() {
  if (consent.acceptResearchConsent()) consent.setLegalAccepted(true);
}

async function handleSubmit() {
  if (!form.validate()) return false;
  if (!consent.legalAccepted.value) return false;
  if (!consent.researchConsentAccepted.value) {
    openResearchConsent();
    return false;
  }
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
