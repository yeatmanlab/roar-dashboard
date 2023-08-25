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
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { marked } from 'marked';

console.log('inside consentModal')
const props = defineProps({
  consentText: { require: true, default: 'Text Here' },
  consentType: { require: true, default: 'Consent' },
})
const consentHeader = {
  tos: "Terms of Service",
  consent: "Consent",
  assent: "Assent"
}
const emit = defineEmits(['accepted']);

const confirm = useConfirm();
const toast = useToast();

const markdownToHtml = computed(() => {
  return marked(props.consentText)
})

onMounted(() => {
  confirm.require({
    group: 'templating',
    header: `${consentHeader[props.consentType]} Form`,
    icon: 'pi pi-question-circle',
    acceptLabel: 'Continue',
    acceptIcon: 'pi pi-check',
    accept: () => {
      emit('accepted');
      toast.add({ severity: 'info', summary: 'Confirmed', detail: `${consentHeader[props.consentType]} status updated.`, life: 3000 });
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
</style>