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

      <PvDialog
        :visible="Boolean(registration.errorMessage.value)"
        header="We could not create your account"
        :style="{ width: 'min(25rem, calc(100vw - 2rem))' }"
        :modal="true"
        :draggable="false"
        @update:visible="registration.dismissError"
      >
        <p role="alert">{{ registration.errorMessage.value }}</p>
        <PvButton label="Close" @click="registration.dismissError" />
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
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import ROARLogoShort from '@/assets/RoarLogo-Short.vue';
import { AccountOwnerForm } from './components';
import { useAccountOwnerForm } from './composables/useAccountOwnerForm';
import { useResearchConsent } from './composables/useResearchConsent';
import { useSelfRegistration } from './composables/useSelfRegistration';

const form = useAccountOwnerForm();
const consent = useResearchConsent();
const registration = useSelfRegistration();

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
</style>
