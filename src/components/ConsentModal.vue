<template>
  <PvToast />
  <PvConfirmDialog
    v-model:visible="dialogVisible"
    group="consent"
    class="confirm"
    :draggable="false"
    :close-on-escape="false"
  >
    <template #message>
      <div class="scrolling-box">
        <!-- @TODO: Add sanitization! -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="markdownToHtml"></div>
      </div>
    </template>
  </PvConfirmDialog>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import * as Sentry from '@sentry/vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvToast from 'primevue/toast';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import _lowerCase from 'lodash/lowerCase';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';

const i18n = useI18n();

const props = defineProps({
  consentText: { type: String, required: true, default: 'Text Here' },
  consentType: { type: String, required: true, default: 'Consent' },
  onConfirm: { type: Function, required: true },
});

const confirm = useConfirm();
const toast = useToast();

const dialogVisible = ref(false);
const isSubmitting = ref(false);

const markdownToHtml = computed(() => {
  const sanitizedHtml = DOMPurify.sanitize(marked(props.consentText));
  return sanitizedHtml;
});

onMounted(() => {
  dialogVisible.value = true;

  const acceptIcon = computed(() => (isSubmitting.value ? 'pi pi-spin pi-spinner mr-2' : 'pi pi-check mr-2'));

  confirm.require({
    group: 'consent',
    header: props.consentType.includes('-es')
      ? `FORMULARIO DE ${_lowerCase(props.consentType).toUpperCase()}`
      : `${_lowerCase(props.consentType).toUpperCase()} FORM`,
    icon: 'pi pi-question-circle',
    acceptLabel: i18n.t('consentModal.acceptButton'),
    acceptClass: 'bg-primary text-white border-none border-round p-2 hover:bg-red-900',
    acceptIcon,
    accept: async () => {
      try {
        isSubmitting.value = true;

        await new Promise((resolve) => setTimeout(resolve, 600));
        await props.onConfirm();

        toast.add({
          severity: TOAST_SEVERITIES.INFO,
          summary: i18n.t('consentModal.toastHeader'),
          detail: props.consentType.includes('-es')
            ? `ESTADO DE ${_lowerCase(props.consentType).toUpperCase()} ACTUALIZADO`
            : `${_lowerCase(props.consentType).toUpperCase()} STATUS UPDATED.`,
          life: TOAST_DEFAULT_LIFE_DURATION,
        });

        dialogVisible.value = false;
      } catch (error) {
        toast.add({
          severity: TOAST_SEVERITIES.ERROR,
          summary: 'Error',
          detail: 'An error occurred while updating the consent status, please try again.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });

        Sentry.captureException(error);

        return Promise.resolve(false);
      } finally {
        isSubmitting.value = false;
      }
    },
  });
});
</script>

<style>
.scrolling-box {
  width: 50vw;
  height: 50vh;
  min-width: 33vw;
  min-height: 25vh;
  padding: 1rem;
  overflow: scroll;
  border: 2px solid var(--surface-d);
  border-radius: 5px;
}

.confirm .p-confirm-dialog-reject {
  display: none !important;
}

.confirm .p-dialog-header-close {
  display: none !important;
}
</style>
