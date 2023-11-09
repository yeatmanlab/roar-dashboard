<template>
  <DataTable :value="skeletonData" responsive-layout="scroll" :scrollable="true" scroll-height="flex">
    <Column v-for="col of Object.keys(skeletonData[0])" :key="col" :field="col">
      <template #header>
        <Skeleton></Skeleton>
      </template>
      <template #body>
        <Skeleton></Skeleton>
      </template>
    </Column>
  </DataTable>
</template>

<script setup>
import { ref } from 'vue';

const skeletonData = ref([
  { col0: '', col1: '', col2: '', col3: '' },
  { col0: '', col1: '', col2: '', col3: '' },
  { col0: '', col1: '', col2: '', col3: '' },
  { col0: '', col1: '', col2: '', col3: '' },
]);
</script>