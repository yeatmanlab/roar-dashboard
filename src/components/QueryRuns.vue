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
          <Calendar
            inputId="startdate"
            v-model="queryStore.startDate"
            dateFormat="mm/dd/yyyy"
            :showIcon="true"
          />
          <label for="startdate">Start date</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2 align-self-end">
        <span class="p-float-label">
          <Calendar
            inputId="enddate"
            v-model="queryStore.endDate"
            dateFormat="mm/dd/yyyy"
            :showIcon="true"
          />
          <label for="enddate">End date</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="tasks"
            v-model="selectedTasks"
            :options="queryStore.tasks"
            optionLabel="id"
            display="chip"
            :loading="!queryStore.tasksReady"
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
            :options="queryStore.variants"
            optionLabel="name"
            optionGroupLabel="task"
            optionGroupChildren="items"
            display="chip"
            :loading="!queryStore.variantsReady"
            :selectAll="true"
          />
          <label for="variants">Variants</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="districts"
            v-model="queryStore.selectedDistricts"
            :options="queryStore.districts"
            optionLabel="District"
            display="chip"
          />
          <label for="districts">Districts</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="schools"
            v-model="queryStore.selectedSchools"
            :options="queryStore.schools"
            optionLabel="School"
            display="chip"
          />
          <label for="schools">Schools</label>
        </span>
      </div>

      <div class="field col-12 md:col-4 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="classes"
            v-model="queryStore.selectedClasses"
            :options="queryStore.classes"
            optionLabel="Class"
            display="chip"
          />
          <label for="classes">Classes</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="studies"
            v-model="queryStore.selectedStudies"
            :options="queryStore.studies"
            optionLabel="Study"
            display="chip"
          />
          <label for="studies">Studies</label>
        </span>
      </div>

      <div class="field col-12 md:col-6 mt-2">
        <span class="p-float-label">
          <MultiSelect
            inputId="roaruids"
            v-model="queryStore.selectedRoarUids"
            :options="queryStore.roarUids"
            optionLabel="roarUid"
            :filter="true"
            filterPlaceholder="Filter by ROAR UID"
            class="multiselect-custom"
            :loading="!queryStore.roarUidsReady"
          />
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
import { useQueryStore } from "@/store/query";

export default {
  setup() {
    const queryStore = useQueryStore();
    onMounted(async () => {
      queryStore.getRootDocs().then(queryStore.getTasks);
    });

    const {
      rootPaths,
      selectedRootPath,
      selectedTasks,
      selectedVariants
    } = storeToRefs(queryStore);

    watch(selectedRootPath, queryStore.getTasks);
    watch(selectedTasks, queryStore.getVariants);

    return {
      queryStore,
      rootPaths,
      selectedRootPath,
      selectedTasks,
      selectedVariants
    };
  }
}

</script>