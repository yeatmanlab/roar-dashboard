<template>
  <div class="page-container">
    <div>
      <h2>Register Students</h2>
    </div>
    <StudentCsvUploader />
  </div>
</template>

<script setup>
import StudentCsvUploader from '@/containers/StudentCsvUploader/index.vue';
</script>

<style>
.page-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 2rem;
}
</style>
