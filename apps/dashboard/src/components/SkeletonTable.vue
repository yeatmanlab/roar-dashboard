<template>
  <PvDataTable :value="skeletonData" responsive-layout="scroll" :scrollable="true" scroll-height="flex">
    <PvColumn v-for="col of Object.keys(skeletonData[0])" :key="col" :field="col">
      <template #header>
        <PvSkeleton></PvSkeleton>
      </template>
      <template #body>
        <PvSkeleton></PvSkeleton>
      </template>
    </PvColumn>
  </PvDataTable>
</template>

<script setup>
import { ref } from 'vue';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvSkeleton from 'primevue/skeleton';

const skeletonData = ref([
  { col0: '', col1: '', col2: '', col3: '' },
  { col0: '', col1: '', col2: '', col3: '' },
  { col0: '', col1: '', col2: '', col3: '' },
  { col0: '', col1: '', col2: '', col3: '' },
]);
</script>
