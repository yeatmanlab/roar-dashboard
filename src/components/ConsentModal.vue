<template>
  <Toast />
  <ConfirmDialog group="templating" class="confirm">
    <template #message="slotProps">
      <div class="scrolling-box">
        <div v-html="markdownToHtml"></div>
      </div>
    </template>
  </ConfirmDialog>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { marked } from 'marked';
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();

const props = defineProps({
  consentText: { require: true, default: 'Text Here' },
  consentType: { require: true, default: 'Consent' },
})
const consentHeader = {
  tos: "Terms of Service",
  consent: "Consent",
  assent: "Assent"
}
const emit = defineEmits(['accepted', 'delayed']);

const confirm = useConfirm();
const toast = useToast();

const markdownToHtml = computed(() => {
  return marked(props.consentText)
})

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const { consentSpinner } = storeToRefs(authStore);

onMounted(() => {
  const delayPromise = delay(4000);
  confirm.require({
    group: 'templating',
    header: `${consentHeader[props.consentType]} Form`,
    icon: 'pi pi-question-circle',
    acceptLabel: 'Continue',
    acceptIcon: 'pi pi-check',
    accept: async () => {
      toast.add({ severity: 'info', summary: 'Confirmed', detail: `${consentHeader[props.consentType]} status updated.`, life: 3000 });
      emit('accepted');
      consentSpinner.value = true;
      await delayPromise.then(() => {
        consentSpinner.value = false;
        emit('delayed');
      });
    },
  });
})
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

.loading-blur {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  background-color: rgba(0, 0, 0, 0.5);
  padding-top: 21vh;
}
</style>