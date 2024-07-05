<template>
  <PvToast />
  <PvDialog
    v-model:visible="isVisible"
    :pt="{ mask: { style: 'backdrop-filter: blur(2px);' } }"
    :draggable="false"
    :modal="false"
    class="border-1h-3rem bg-white"
  >
    <template #container>
      <div v-if="!docCreated" class="bg-white p-3 border-1 border-round w-full">
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
      <div v-else class="bg-white p-3 border-1 border-round w-full">
        <h2>Please review your email to sign the document and proceed</h2>
        <div class="justify-content-center flex">
          <img src="../assets/signDoc2.webp" style="width: 400px; border-radius: 0.5rem" />
        </div>
      </div>
    </template>
  </PvDialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { createAgreement } from '../helpers/query/adobeSign';

const signerEmail = ref('');
const docCreated = ref(false);
const isVisible = ref(false);
const isAdult = ref(false);
const emit = defineEmits(['consent-selected']);

const toast = useToast();

const props = defineProps({
  isAdobe: { type: Boolean, required: true, default: false },
  isAdult: { type: Boolean, required: true, default: false },
});

isVisible.value = props.isAdobe;

async function createConsent() {
  docCreated.value = true;

  let isSigned = await createAgreement(signerEmail.value, props.isAdult);
  if (isSigned === 'SIGNED') {
    props.isAdobe = false;
    isVisible.value = false;
    emit('consent-signed', isSigned);
  } else {
    docCreated.value = false;
    toast.add({ severity: 'error', summary: 'Please retry', detail: 'Document not signed', life: 3000 });
  }
}
</script>
