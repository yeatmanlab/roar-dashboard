<template>
  <div class="mt-5 flex flex-row flex-wrap justify-content-center card-container">
    <Card class="m-4" style="width: 25em">
      <template #title>
        Query ROAR Assessment Results
      </template>
      <template #content>
        <p>
          Click below to interactively query ROAR assessment data. You must be an
          authenticated user to access this data.
        </p>
      </template>
      <template #footer>
        <router-link :to="{ name: 'Query' }">
          <Button icon="pi pi-search" label="Query" />
        </router-link>
      </template>
    </Card>
    <Card class="m-4" style="width: 25em">
      <template #title>
        Generate a Score Report from your own files
      </template>
      <template #content>
        <p>
          Click below to generate a score report from CSV files on your own computer.
        </p>
      </template>
      <template #footer>
        <router-link :to="{ name: 'UploadScores' }">
          <Button icon="pi pi-chart-line" label="Generate Report" />
        </router-link>
      </template>
    </Card>
  </div>
</template>

<script setup>
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
