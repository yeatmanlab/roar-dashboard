<template>
  <div>
    <div v-if="authStore.homepageReady">
      <Toast />
      <FileUpload class="mt-3" mode="basic" name="scorereport[]" :customUpload="true" @uploader="onScoreUpload"
        accept=".csv" :multiple="false" :auto="true" chooseLabel="Choose a score file">
        <!-- <template #empty>
          <p>Drag and drop the score file here to upload.</p>
        </template> -->
      </FileUpload>
      <FileUpload class="my-3" mode="basic" name="adminreport[]" :customUpload="true" @uploader="onAdminUpload"
        accept=".csv" :multiple="false" :auto="true" chooseLabel="Choose an identifier file">
        <!-- <template #empty>
          <p>Drag and drop the identifier file here to upload.</p>
        </template> -->
      </FileUpload>
      <Button icon="pi pi-chart-line" label="View Score Report" class="flex-none mb-1 ml-2"
        :loading="scoreStore.scores.length === 0" :disabled="scoreStore.scores.length === 0" @click="submit" />
    </div>
    <AppSpinner v-else />
  </div>
</template>

<script setup>
import { useAuthStore } from "@/store/auth";
import { useScoreStore } from "@/store/scores";
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { csvFileToJson } from '@/helpers';
import { useRouter } from 'vue-router';

const router = useRouter();
const authStore = useAuthStore();
const scoreStore = useScoreStore();
const toast = useToast();
const uploadedFile = ref();
const onScoreUpload = async (event) => {
  toast.add({ severity: 'info', summary: 'Success', detail: 'Score File Uploaded', life: 3000 });
  uploadedFile.value = event.files[0];
  scoreStore.appScores = await csvFileToJson(uploadedFile.value);
}
const onAdminUpload = async (event) => {
  toast.add({ severity: 'info', summary: 'Success', detail: 'Identifier File Uploaded', life: 3000 });
  uploadedFile.value = event.files[0];
  scoreStore.identifiers = await csvFileToJson(uploadedFile.value);
}
const submit = () => {
  router.push({ name: "ScoreReport" });
}
</script>

<style scoped>

</style>
