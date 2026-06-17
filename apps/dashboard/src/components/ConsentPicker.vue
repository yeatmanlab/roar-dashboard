<template>
  <PvPanel class="m-0 p-0 w-full" header="Select Consent and Assent Forms">
    <div class="flex justify-content-center mt-2">
      <PvCheckbox v-model="noConsent" :binary="true" input-id="no-consent" class="flex" />
      <label class="ml-2 flex text-center" for="no-consent"
        >This administration does not require consent or assent forms</label
      >
    </div>

    <div v-if="!noConsent" class="flex flex-column gap-3 mt-4" style="max-width: 32rem">
      <div class="flex flex-column gap-1">
        <label for="consent-agreement" class="font-bold">Consent Form</label>
        <PvSelect
          id="consent-agreement"
          v-model="selectedConsentId"
          :options="consentAgreements ?? []"
          option-label="name"
          option-value="id"
          placeholder="Select a Consent Form"
          show-clear
          data-cy="select-consent"
          @change="emitSelection"
        />
      </div>

      <div class="flex flex-column gap-1">
        <label for="assent-agreement" class="font-bold">Assent Form</label>
        <PvSelect
          id="assent-agreement"
          v-model="selectedAssentId"
          :options="assentAgreements ?? []"
          option-label="name"
          option-value="id"
          placeholder="Select an Assent Form"
          show-clear
          data-cy="select-assent"
          @change="emitSelection"
        />
      </div>
    </div>
  </PvPanel>
</template>

<script setup>
import { ref, watch } from 'vue';
import PvCheckbox from 'primevue/checkbox';
import PvPanel from 'primevue/panel';
import PvSelect from 'primevue/select';
import useAgreementsQuery from '@/composables/queries/useAgreementsQuery';
import { AGREEMENT_TYPES } from '@/constants/agreements';

/**
 * Consent / assent agreement picker.
 *
 * Lets an administrator choose a consent agreement and an assent agreement (or
 * mark the administration as requiring neither) from the agreements API. Emits
 * the selected agreement UUIDs — `{ consent, assent }` — or the string
 * `'No Consent'` when the no-consent box is checked, or `''` when it is cleared.
 *
 * @NOTE This replaces the legacy legal-document picker. The old "help me choose"
 * guided flow and the payment-amount / expected-time inputs are gone: agreements
 * have no params to drive the guided flow, and those fields are no longer stored
 * on an administration.
 */
const props = defineProps({
  consentId: { type: String, required: false, default: null },
  assentId: { type: String, required: false, default: null },
  noConsent: { type: Boolean, required: false, default: false },
});

const emit = defineEmits(['consent-selected']);

const { data: consentAgreements } = useAgreementsQuery(AGREEMENT_TYPES.CONSENT);
const { data: assentAgreements } = useAgreementsQuery(AGREEMENT_TYPES.ASSENT);

const selectedConsentId = ref(props.consentId);
const selectedAssentId = ref(props.assentId);
const noConsent = ref(props.noConsent);

// Pre-fill when the parent resolves existing values (edit / duplicate).
watch(
  () => [props.consentId, props.assentId, props.noConsent],
  ([consentId, assentId, isNoConsent]) => {
    selectedConsentId.value = consentId;
    selectedAssentId.value = assentId;
    noConsent.value = isNoConsent;
  },
);

const emitSelection = () => {
  emit('consent-selected', {
    consent: selectedConsentId.value ?? null,
    assent: selectedAssentId.value ?? null,
  });
};

watch(noConsent, (isNoConsent) => {
  if (isNoConsent) {
    selectedConsentId.value = null;
    selectedAssentId.value = null;
    emit('consent-selected', 'No Consent');
  } else {
    emit('consent-selected', '');
  }
});
</script>
