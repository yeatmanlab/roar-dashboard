<template>
  <div>
    <StepNavigation
      title="Upload"
      :next-step="REGISTRATION_STEPS.REQUIRED"
      :disabled="!readyToProgress"
      @next="$emit('activate', $event)"
    />
    <div class="step-container">
      <div class="w-full">
        <div v-if="_isEmpty(rawStudentFile)" class="text-gray-500 surface-100 border-round-top-md">
          <PvFileUpload
            name="massUploader[]"
            class="bg-primary text-white border-none border-round hover:bg-red-900"
            custom-upload
            accept=".csv"
            auto
            :show-upload-button="false"
            :show-cancel-button="false"
            @uploader="onFileUpload($event)"
          >
            <template #empty>
              <div class="extra-height ml-6 text-gray-500">
                <p>Drag and drop files to here to upload.</p>
              </div>
            </template>
          </PvFileUpload>
        </div>
        <div v-else>
          <div class="flex py-3 justify-between">
            <Button v-if="!_isEmpty(rawStudentFile)" label="Upload a different File" @click="resetUpload()" />
            <Button
              label="Next"
              :disabled="!readyToProgress"
              icon="pi pi-arrow-right"
              @click="$emit('activate', REGISTRATION_STEPS.REQUIRED)"
            />
          </div>
          <PvDataTable
            ref="dataTable"
            :value="rawStudentFile"
            show-gridlines
            :row-hover="true"
            :resizable-columns="true"
            paginator
            :always-show-paginator="false"
            :rows="10"
            class="datatable"
          >
            <PvColumn v-for="col of tableColumns" :key="col.field" :field="col.field">
              <template #header>
                <b>{{ col.header }}</b>
              </template>
            </PvColumn>
          </PvDataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import PvFileUpload from 'primevue/fileupload';
import PvDataTable from 'primevue/datatable';
import PvColumn from 'primevue/column';
import Button from 'primevue/button';
import _isEmpty from 'lodash/isEmpty';
import { REGISTRATION_STEPS } from '@/constants/studentRegistration';
import StepNavigation from '../common/StepNavigation.vue';

const props = defineProps({
  rawStudentFile: {
    type: Array,
    required: true,
  },
  tableColumns: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['file-upload', 'reset-upload', 'activate']);

const readyToProgress = computed(() => !_isEmpty(props.rawStudentFile));

function onFileUpload(event) {
  emit('file-upload', event);
}

function resetUpload() {
  emit('reset-upload');
}
</script>
