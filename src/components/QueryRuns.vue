<template>
  <Panel :toggleable="true" :collapsed="false" class="mb-2">
    <template #header>
      <i class="pi pi-filter mr-2"></i>
      Query Filters
    </template>
    <div class="p-fluid grid formgrid text-left">
      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <TreeSelect inputId="tasks" v-model="selectedTasks" :options="tasks" display="chip" selectionMode="checkbox" />
          <label for="tasks">Tasks / Variants</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect v-model="selectedRoarUids" :options="roarUids" optionLabel="name" :filter="true" filterPlaceholder="Filter by ROAR UID" class="multiselect-custom" />
          <label for="districts">ROAR UID / PID</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <Calendar inputId="startdate" v-model="startDate" dateFormat="mm/dd/yyyy" :showIcon="true" />
          <label for="startdate">Start date</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <Calendar inputId="enddate" v-model="endDate" dateFormat="mm/dd/yyyy" :showIcon="true" />
          <label for="enddate">End date</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="districts" v-model="selectedDistricts" :options="districts" optionLabel="District" display="chip" />
          <label for="districts">Districts</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="schools" v-model="selectedSchools" :options="schools" optionLabel="School" display="chip" />
          <label for="schools">Schools</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="classes" v-model="selectedClasses" :options="classes" optionLabel="Class" display="chip" />
          <label for="classes">Classes</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="studies" v-model="selectedStudies" :options="studies" optionLabel="Study" display="chip" />
          <label for="studies">Studies</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <TreeSelect inputId="rootdoc" v-model="selectedRootDocs" :options="rootDocs" display="chip" selectionMode="checkbox"></TreeSelect>
          <label for="rootdoc">Database collection</label>
        </span>
      </div>
    </div>
  </Panel>

  <Panel>
    <template #header>
      <i class="pi pi-table mr-2"></i>
      Results
    </template>
    <AppSpinner />
  </Panel>
</template>

<script setup>
// import { useFireStore } from "@/store/firestore";

// const fireStore = useFireStore();

// onMounted(async () => {
//   await fireStore.retrieveTasks();
// });
</script>