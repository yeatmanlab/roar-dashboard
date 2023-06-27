<template>
  <ParticipantList></ParticipantList>
  <div class="mt-5 flex flex-row flex-wrap justify-content-center card-container">
    <Card class="m-4" style="width: 25em">
      <!-- <template #header>
        <img src="https://www.primefaces.org/wp-content/uploads/2020/02/primefacesorg-primevue-2020.png"
          style="height: 15rem" />
      </template> -->
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
      <!-- <template #header>
        <img src="https://www.primefaces.org/wp-content/uploads/2020/02/primefacesorg-primevue-2020.png"
          style="height: 15rem" />
      </template> -->
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
import ParticipantList from '@/components/admin/ParticipantList.vue';

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
