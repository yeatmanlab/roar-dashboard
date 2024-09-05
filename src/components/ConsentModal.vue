<template>
  <PvToast />
  <PvConfirmDialog group="templating" class="confirm" :close-on-escape="false">
    <template #message>
      <div class="scrolling-box">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="markdownToHtml"></div>
      </div>
    </template>
  </PvConfirmDialog>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { marked } from 'marked';
import { useAuthStore } from '@/store/auth';
import { useI18n } from 'vue-i18n';
import _lowerCase from 'lodash/lowerCase';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const i18n = useI18n();
const router = useRouter();

const props = defineProps({
  consentText: { type: String, require: true, default: 'Text Here' },
  consentType: { type: String, require: true, default: 'Consent' },
});

const emit = defineEmits(['accepted', 'delayed']);

const confirm = useConfirm();
const toast = useToast();

const markdownToHtml = computed(() => {
  return marked(props.consentText);
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { consentSpinner } = storeToRefs(authStore);

onMounted(() => {
  const delayPromise = delay(1000);
  confirm.require({
    group: 'templating',
    header: i18n.t(`consentModal.header`, props.consentType.toUpperCase()),
    icon: 'pi pi-question-circle',
    acceptLabel: i18n.t('consentModal.acceptButton', 'Accept'),
    rejectLabel: i18n.t('consentModal.rejectButton', 'Reject'),
    acceptClass: 'bg-green-600 text-white border-none border-round p-2 hover:bg-green-800',
    acceptIcon: 'pi pi-check mr-2',
    rejectClass: 'bg-red-600 text-white border-none border-round p-2 hover:bg-red-800',
    rejectIcon: 'pi pi-times mr-2',
    accept: async () => {
      toast.add({
        severity: 'info',
        summary: i18n.t('consentModal.toastHeader'),
        detail: i18n.t(`consentModal.${_lowerCase(props.consentType)}UpdatedStatus`),
        life: 3000,
      });
      emit('accepted');
      consentSpinner.value = true;
      await delayPromise.then(() => {
        consentSpinner.value = false;
        emit('delayed');
      });
    },
    reject: () => {
      authStore.signOut();
      router.push({ name: 'SignOut' });
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
