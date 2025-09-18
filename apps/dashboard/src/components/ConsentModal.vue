<template>
  <PvToast />
  <PvConfirmDialog
    v-model:visible="dialogVisible"
    group="consent"
    class="confirm"
    :draggable="false"
    :close-on-escape="false"
    :closable="false"
    data-cy="consent-modal"
    pt:title:data-testid="consent-modal__title"
    pt:footer:data-testid="consent-modal__footer"
    :accept-label="i18n.t('consentModal.acceptButton')"
    :reject-label="i18n.t('consentModal.optOutButton')"
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

const emit = defineEmits(['optOut']);

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
  const header = props.consentType.includes('consent')
    ? i18n.t('consentModal.consentTitle')
    : i18n.t('consentModal.assentTitle');

  confirm.require({
    group: 'consent',
    header: header,
    icon: 'pi pi-question-circle',
    acceptClass: 'bg-primary text-white border-none border-round p-2 hover:bg-red-900',
    rejectClass: 'bg-gray-500 text-white border-none border-round p-2 hover:bg-gray-700',
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
          detail: 'An error occurred while updating the consent status, please reload the page and try again.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });

        Sentry.captureException(error);

        return Promise.resolve(false);
      } finally {
        isSubmitting.value = false;
      }
    },
    reject: async () => {
      try {
        isSubmitting.value = true;
        emit('optOut');
        toast.add({
          severity: TOAST_SEVERITIES.INFO,
          summary: i18n.t('consentModal.toastHeader'),
          detail: 'You have opted out of research participation.',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });
        dialogVisible.value = false;
      } catch (error) {
        toast.add({
          severity: TOAST_SEVERITIES.ERROR,
          summary: 'Error',
          detail: 'An error occurred while updating your opt-out status, please reload the page and try again.',
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

.confirm .p-confirmdialog-reject-button {
  margin-right: 0.5rem;
}

.confirm .p-dialog-header-close {
  display: none !important;
}
</style>
