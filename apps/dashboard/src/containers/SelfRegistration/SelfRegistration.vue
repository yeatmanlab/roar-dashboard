<template>
  <div id="register-container" class="self-registration">
    <section id="register">
      <header>
        <div class="flex flex-wrap p-3 justify-content-around align-items-center gap-3">
          <div class="signin-logo">
            <ROARLogoShort />
          </div>
          <div class="flex flex-wrap flex-column align-items-start gap-2">
            <div class="flex">
              <div class="text-center font-bold text-3xl text-red-800 mb-1 italic">ROAR@Home</div>
              <div class="text-sm font-bold text-red-800 ml-1 uppercase">beta</div>
            </div>
            <div class="bg-gray-100 rounded p-2">
              <div class="flex flex-wrap text-gray-600 text-md font-bold">Create your account</div>
              <div class="flex flex-wrap text-gray-400 text-sm">Sign up to start ROARing</div>
            </div>
          </div>
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

// Field validity stays out of the disabled state so submitting an incomplete
// form can reveal actionable field-level errors.
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
</style>
