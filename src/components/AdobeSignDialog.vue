<template>
  <PvToast />
  <PvDialog
    v-model:visible="isVisible"
    :pt="{ mask: { style: 'backdrop-filter: blur(2px);' } }"
    :draggable="false"
    :modal="true"
    class="border-1h-3rem bg-white w-8"
  >
    <template #container>
      <div v-if="!docCreated" class="bg-white p-3 border-1 border-round">
        <p class="text-center">
          To proceed, please enter your email address below. <br />
          This will initiate an Adobe Sign workflow to securely obtain your signature on a required
          {{ isAdult ? 'consent' : 'assent' }} form.
        </p>
        <div class="p-10 flex justify-content-center w-full">
          <PvInputText
            id="signer-email"
            v-model="signerEmail"
            class="w-10"
            style="width: 25rem"
            placeholder="Email"
            type="email"
            enabled
          />
        </div>
        <div class="flex justify-content-center">
          <PvButton
            label="Done"
            class="no-underline bg-primary mt-2 border-none border-round p-3 w-5 text-white hover:bg-red-900"
            @click="createConsent"
          />
        </div>
      </div>
      <div v-if="hasSigningUrl" class="bg-white border-1 border-round w-full text-center">
        <div class="flex flex-row">
          <div class="justify-content-center flex">
            <img src="../assets/signDoc2.webp" style="width: 40vh; padding: 0px" />
          </div>
          <div class="flex flex-column justify-content-center p-5">
            <h3>
              Thank you! An email has been sent to <span class="font-bold">{{ signerEmail }}</span> with further
              instructions to sign the consent form. <br />
              <br />
              Please go to your inbox and complete the signing process.
            </h3>
            <h3>Alternatively, you can click the link below to go directly to the signing page:</h3>
            <h4>
              <a :href="adobeUrl" target="blank"> Sign the form now </a>
            </h4>
          </div>
        </div>
      </div>
      <div v-if="!hasSigningUrl && docCreated">
        <div class="flex flex-row">
          <div class="justify-content-center flex">
            <img src="../assets/loadinglion.webp" style="width: 40vh; padding: 0px" />
          </div>
          <div class="flex flex-column justify-content-center p-5">
            <h3>We are creating your agreement document.</h3>
            <h4>Please wait a few seconds</h4>
          </div>
        </div>
      </div>
    </template>
  </PvDialog>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import PvToast from 'primevue/toast';
import PvDialog from 'primevue/dialog';
import PvInputText from 'primevue/inputtext';
import PvButton from 'primevue/button';

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const initialized = ref(false);
const agreementId = ref(null);
const docStatus = ref(null);
const adobeUrl = ref(null);
const hasSigningUrl = ref(false);
let unsubscribe;

const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

const signerEmail = ref('');
const docCreated = ref(false);
const isVisible = ref(false);
const emit = defineEmits(['consent-signed']);

const toast = useToast();

const props = defineProps({
  isAdobe: { type: Boolean, required: true, default: false },
  isAdult: { type: Boolean, required: true, default: false },
  parentEmail: { type: String, required: false, default: null },
});

if (props.parentEmail) {
  signerEmail.value = props.parentEmail;
  createConsent();
}

isVisible.value = props.isAdobe;

async function createConsent() {
  agreementId.value = null;
  docCreated.value = true;
  let docType = props.isAdult ? 'Consent' : 'Assent';

  agreementId.value = await authStore.createAdobeSignAgreement(signerEmail.value, docType);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  if (agreementId.value) {
    adobeUrl.value = await authStore.getAdobeSignSigningUrl(agreementId.value, signerEmail.value);
    hasSigningUrl.value = true;
  }

  let tries = 0;

  while (tries < 60) {
    docStatus.value = await authStore.getAdobeSignAgreementStatus(agreementId.value);
    if (docStatus.value !== 'SIGNED') {
      tries += 1;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      tries = 60;
    }
  }

  // Check this after putting new email

  if (docStatus.value === 'SIGNED') {
    // props.isAdobe = false;
    isVisible.value = false;
    toast.add({ severity: 'success', summary: 'Success', detail: 'Document has been signed!', life: 3000 });
    emit('consent-signed', docStatus.value);
  } else {
    docCreated.value = false;
    hasSigningUrl.value = false;
    toast.add({ severity: 'error', summary: 'Please retry', detail: 'Document not signed', life: 3000 });
  }
}
</script>
