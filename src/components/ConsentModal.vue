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

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Ref, ComputedRef } from 'vue';
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
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const i18n = useI18n();
const router = useRouter();
const authStore = useAuthStore();

interface Props {
  consentText: string;
  consentType: string;
  onConfirm: () => Promise<void> | void;
}

const props = defineProps<Props>();

const confirm = useConfirm();
const toast = useToast();

const dialogVisible: Ref<boolean> = ref(false);
const isSubmitting: Ref<boolean> = ref(false);

const markdownToHtml: ComputedRef<string> = computed(() => {
  const textToMark = typeof props.consentText === 'string' ? props.consentText : '';
  const sanitizedHtml = DOMPurify.sanitize(marked(textToMark));
  return typeof sanitizedHtml === 'string' ? sanitizedHtml : '';
});

onMounted(() => {
  dialogVisible.value = true;

  confirm.require({
    group: 'consent',
    header: i18n.t(`consentModal.header`, { type: props.consentType.toUpperCase() }),
    message: '',
    icon: 'pi pi-question-circle',
    acceptLabel: i18n.t('consentModal.acceptButton', 'Accept'),
    rejectLabel: i18n.t('consentModal.rejectButton', 'Reject'),
    acceptClass: 'bg-green-600 text-white border-none border-round p-2 hover:bg-green-800',
    acceptIcon: 'pi pi-check mr-2',
    rejectClass: 'bg-red-600 text-white border-none border-round p-2 hover:bg-red-800',
    rejectIcon: 'pi pi-times mr-2',
    accept: async (): Promise<void> => {
      try {
        isSubmitting.value = true;

        await new Promise((resolve) => setTimeout(resolve, 600));
        await props.onConfirm();

        toast.add({
          severity: TOAST_SEVERITIES.INFO,
          summary: i18n.t('consentModal.toastHeader'),
          detail: i18n.t(`consentModal.${_lowerCase(props.consentType)}UpdatedStatus`),
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
      } finally {
        isSubmitting.value = false;
      }
    },
    reject: (): void => {
      (authStore as any).signOut();
      router.push({ name: 'SignOut' });
    },
    onHide: () => {
      dialogVisible.value = false;
    }
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

/* .confirm .p-confirm-dialog-reject {
  display: block !important;
} */

.p-dialog .p-dialog-content {
  padding: 1rem;
}

.confirm .p-dialog-footer {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.p-dialog .p-dialog-footer {
  padding: 1rem;
}

.confirm .p-dialog-header-close {
  display: none !important;
}
</style>
