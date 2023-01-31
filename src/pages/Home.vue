<template>
  <div>
    <div v-if="authStore.homepageReady">
      <Toast />
      <FileUpload name="report[]" :customUpload="true" @uploader="onUpload" accept=".csv" :multiple="false" :auto="true" >
        <template #empty>
          <p>Drag and drop files to here to upload.</p>
        </template>
      </FileUpload>
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
const onUpload = async (event) => {
  toast.add({ severity: 'info', summary: 'Success', detail: 'File Uploaded', life: 3000 });
  uploadedFile.value = event.files[0];
  scoreStore.scores = await csvFileToJson(uploadedFile.value);
  router.push({ name: "ScoreReport" });
}
</script>

<style scoped>
</style>
