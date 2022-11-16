<template>
  <Panel :toggleable="true" :collapsed="false" class="mb-2">
    <template #header>
      <i class="pi pi-filter mr-2"></i>
      Query Filters
    </template>
    <div class="p-fluid grid formgrid text-left">
      <div class="field col-12 md:col-4 mt-0">
        <p class="mb-1 mt-0 mx-1">Choose the database to query</p>
        <div class="p-inputgroup">
          <span class="p-inputgroup-addon">
            <i class="pi pi-database"></i>
          </span>
          <Dropdown
            inputId="rootdoc"
            v-model="selectedRootPath"
            :options="rootPaths"
            optionLabel="label"
            optionGroupLabel="label"
            optionGroupChildren="items"
          >
            <template #optiongroup="slotProps">
              <div class="flex align-items-center country-item">
                <i class="pi pi-folder-open mr-2"></i>
                <div>{{slotProps.option.label}}</div>
              </div>
            </template>
          </Dropdown>
        </div>
      </div>

      <div class="field col-12 md:col-4 mt-2 align-self-end">
        <span class="p-float-label">
          <Calendar inputId="startdate" v-model="fireStore.startDate" dateFormat="mm/dd/yyyy" :showIcon="true" />
          <label for="startdate">Start date</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2 align-self-end">
        <span class="p-float-label">
          <Calendar inputId="enddate" v-model="fireStore.endDate" dateFormat="mm/dd/yyyy" :showIcon="true" />
          <label for="enddate">End date</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="tasks"
            v-model="selectedTasks"
            :options="fireStore.tasks"
            optionLabel="id"
            display="chip"
            :loading="!fireStore.tasksReady"
            :filter="true"
          />
          <label for="tasks">Tasks</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="variants"
            v-model="selectedVariants"
            :options="fireStore.variants"
            optionLabel="name"
            optionGroupLabel="task"
            optionGroupChildren="items"
            display="chip"
            :loading="!fireStore.variantsReady"
          />
          <label for="variants">Variants</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="districts" v-model="fireStore.selectedDistricts" :options="fireStore.districts" optionLabel="District" display="chip" />
          <label for="districts">Districts</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="schools" v-model="fireStore.selectedSchools" :options="fireStore.schools" optionLabel="School" display="chip" />
          <label for="schools">Schools</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="classes" v-model="fireStore.selectedClasses" :options="fireStore.classes" optionLabel="Class" display="chip" />
          <label for="classes">Classes</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="studies" v-model="fireStore.selectedStudies" :options="fireStore.studies" optionLabel="Study" display="chip" />
          <label for="studies">Studies</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect inputId="roaruids" v-model="fireStore.selectedRoarUids" :options="fireStore.roarUids" optionLabel="name" :filter="true" filterPlaceholder="Filter by ROAR UID" class="multiselect-custom" />
          <label for="roaruids">ROAR UID / PID</label>
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

<script>
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia'
import { useFireStore } from "@/store/firestore";

export default {
  setup() {
    const fireStore = useFireStore();
    onMounted(async () => {
      fireStore.getRootDocs().then(fireStore.getTasks);
    });

    const { rootPaths, selectedRootPath, selectedTasks } = storeToRefs(fireStore);

    watch(selectedRootPath, fireStore.getTasks);
    watch(selectedTasks, fireStore.getVariants);

    return { fireStore, rootPaths, selectedRootPath, selectedTasks };
  }
}

</script>