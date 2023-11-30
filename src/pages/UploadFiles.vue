<template>
  <div>
    <PvToast />
    <PvFileUpload
      class="mt-3"
      mode="basic"
      name="scorereport[]"
      :custom-upload="true"
      accept=".csv"
      :multiple="false"
      :auto="true"
      choose-label="Choose a score file"
      @uploader="onScoreUpload"
    >
      <!-- <template #empty>
        <p>Drag and drop the score file here to upload.</p>
      </template> -->
    </PvFileUpload>
    <PvFileUpload
      class="my-3"
      mode="basic"
      name="adminreport[]"
      :custom-upload="true"
      accept=".csv"
      :multiple="false"
      :auto="true"
      choose-label="Choose an identifier file"
      @uploader="onAdminUpload"
    >
      <!-- <template #empty>
        <p>Drag and drop the identifier file here to upload.</p>
      </template> -->
    </PvFileUpload>
    <PvButton
      icon="pi pi-chart-line"
      label="View Score Report"
      class="flex-none mb-1 ml-2"
      :loading="scoreStore.scores.length === 0"
      :disabled="scoreStore.scores.length === 0"
      @click="submit"
    />
  </div>
</template>

<script setup>
import { useScoreStore } from '@/store/scores';
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { csvFileToJson } from '@/helpers';
import { useRouter } from 'vue-router';

const router = useRouter();
const scoreStore = useScoreStore();
const toast = useToast();
const uploadedFile = ref();
const onScoreUpload = async (event) => {
  toast.add({ severity: 'info', summary: 'Success', detail: 'Score File Uploaded', life: 3000 });
  uploadedFile.value = event.files[0];
  scoreStore.appScores = await csvFileToJson(uploadedFile.value);
};
const onAdminUpload = async (event) => {
  toast.add({ severity: 'info', summary: 'Success', detail: 'Identifier File Uploaded', life: 3000 });
  uploadedFile.value = event.files[0];
  scoreStore.identifiers = await csvFileToJson(uploadedFile.value);
};
const submit = () => {
  router.push({ name: 'ScoreReport' });
};
</script>

<style scoped></style>
