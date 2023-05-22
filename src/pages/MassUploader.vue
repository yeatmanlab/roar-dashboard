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
      <div class="info-box">
        test
      </div>
      <DataTable :columns="tableColumns" :data="rawStudentFile" :allowExport="false" />
    </div>
  </div>
</template>
<script setup>
import { ref, toRaw } from 'vue';
import DataTable from '@/components/RoarDataTable.vue'
import { csvFileToJson } from '@/helpers';
import _forEach from 'lodash/forEach'
import _startCase from 'lodash/startCase'
const isFileUploaded = ref(false)
const rawStudentFile = ref({})
const tableColumns = ref([])
const onFileUpload = async (event) => {
  rawStudentFile.value = await csvFileToJson(event.files[0])
  // console.log(rawStudentFile.value)
  generateColumns(toRaw(rawStudentFile.value))
  isFileUploaded.value = true;
}

function generateColumns(rawJson){
  const columnValues = Object.keys(rawJson[0])
  console.log(rawJson[30]['created'])
  console.log(typeof rawJson[0]['created'])
  console.log(rawJson[0]['created'] instanceof Date)
  // let tableColumns = []
  _forEach(columnValues, col => {
    let dataType = (typeof rawJson[0][col])
    if(dataType === 'object'){
      if(rawJson[0][col] instanceof Date) dataType = 'date'
    }
    tableColumns.value.push({
      field: col,
      header: _startCase(col),
      dataType: dataType
    })
  })
  console.log('columnValues', columnValues)
  console.log('tableColumns', tableColumns)

}
</script>
<style scoped>
.page-container {
  padding: 2rem;
}
.extra-height {
  min-height: 33vh;
}
.info-box {
  background-color: var(--surface-b);
  border-radius: 5px;
  border: 1px solid var(--surface-d);
}
</style>