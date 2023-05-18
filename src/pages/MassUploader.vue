<template>
  <div class="page-container">
    <!--Upload file section-->
    <div v-if="!isFileUploaded">
      <FileUpload 
        name="massUploader[]"
        customUpload
        @uploader="onFileUpload($event)"
        accept=".csv"
        auto
        :showUploadButton="false"
        :showCancelButton="false"
      >
        <template #empty>
          <div class="extra-height">
            <p>Drag and drop files to here to upload.</p>
          </div>
          
        </template>
      </FileUpload>
    </div>
    <!--DataTable with raw Student-->
    <div v-if="isFileUploaded">
      {{ rawStudentFile }}
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { csvFileToJson } from '@/helpers';
const isFileUploaded = ref(false)
const rawStudentFile = ref({})
const onFileUpload = async (event) => {
  console.log(event)
  rawStudentFile.value = await csvFileToJson(event.files[0])
  isFileUploaded.value = true;
}
</script>
<style scoped>
.page-container {
  padding: 2rem;
}
.extra-height {
  min-height: 33vh;
}
</style>