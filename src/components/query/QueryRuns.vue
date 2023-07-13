<template>
  <div class="p-fluid grid formgrid text-left">
    <div class="field col-12 md:col-6 mt-0">
      <p class="mb-1 mt-0 mx-1">Choose the database to query</p>
      <div class="p-inputgroup">
        <span class="p-inputgroup-addon">
          <i class="pi pi-database"></i>
        </span>
        <Dropdown inputId="rootdoc" v-model="selectedRootPath" :options="rootPaths" optionLabel="label"
          optionGroupLabel="label" optionGroupChildren="items">
          <template #optiongroup="slotProps">
            <div class="flex align-items-center country-item">
              <i class="pi pi-folder-open mr-2"></i>
              <div>{{ slotProps.option.label }}</div>
            </div>
          </template>
        </Dropdown>
      </div>
    </div>

    <div class="col-12 md:col-6"></div>

    <div class="field col-12 md:col-6">
      <p class="mb-1 mt-0 mx-1">Choose the ROAR task</p>
      <div class="p-inputgroup">
        <span class="p-inputgroup-addon">
          <i class="pi pi-angle-right"></i>
        </span>
        <MultiSelect inputId="tasks" v-model="selectedTasks" :options="queryStore.tasks" optionLabel="id"
          :loading="!queryStore.tasksReady" :filter="true" filterPlaceholder="Filter tasks" placeholder="Select tasks"
          :selectionLimit="10" :maxSelectedLabels="4" :virtualScrollerOptions="{ itemSize: 40 }" />
      </div>
    </div>

    <div class="field col-12 md:col-6 align-self-end">
      <p class="mb-1 mt-0 mx-1">Select variants</p>
      <div class="p-inputgroup">
        <span class="p-inputgroup-addon">
          <i class="pi pi-angle-double-right"></i>
        </span>
        <MultiSelect inputId="variants" v-model="selectedVariants" :options="queryStore.variants" optionLabel="name"
          optionGroupLabel="task" optionGroupChildren="items" :loading="!queryStore.variantsReady" :filter="true"
          filterPlaceholder="Filter variants"
          :placeholder="queryStore.variantsReady ? 'Select variants' : 'Choose tasks first to load available variants'"
          :selectionLimit="10" :maxSelectedLabels="4" :virtualScrollerOptions="{ itemSize: 40 }" />
      </div>
    </div>

    <div v-if="queryStore.selectedTasks.length === 0" class="field col-12 md:col-12 m-0 p-0">
      <Message severity="warn" class="text-left m-0" :closable="false">
        Select tasks above to enable to following query fields.
      </Message>
    </div>

    <div class="field col-12 md:col-6 mt-2">
      <span class="p-float-label">
        <MultiSelect inputId="roaruids" v-model="queryStore.selectedUsers" :options="queryStore.users"
          optionLabel="roarUid" :loading="!queryStore.usersReady" :filter="true" filterPlaceholder="Filter ROAR UIDs"
          :maxSelectedLabels="5" :virtualScrollerOptions="{ itemSize: 40 }" />
        <label for="roaruids">ROAR UID / PID</label>
      </span>
    </div>

    <div class="field col-12 md:col-6 mt-2">
      <span class="p-float-label">
        <MultiSelect inputId="studies" v-model="queryStore.selectedStudies" :options="queryStore.studies" optionLabel="id"
          :loading="!queryStore.usersReady" :maxSelectedLabels="4" />
        <label for="studies">Studies</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2">
      <span class="p-float-label">
        <MultiSelect inputId="districts" v-model="queryStore.selectedDistricts" :options="queryStore.districts"
          optionLabel="id" :loading="!queryStore.usersReady" :maxSelectedLabels="4" />
        <label for="districts">Districts</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2">
      <span class="p-float-label">
        <MultiSelect inputId="schools" v-model="queryStore.selectedSchools" :options="queryStore.schools" optionLabel="id"
          :loading="!queryStore.usersReady" :maxSelectedLabels="4" />
        <label for="schools">Schools</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2">
      <span class="p-float-label">
        <MultiSelect inputId="classes" v-model="queryStore.selectedClasses" :options="queryStore.classes" optionLabel="id"
          :loading="!queryStore.usersReady" :maxSelectedLabels="4" />
        <label for="classes">Classes</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2 mb-0 align-self-end">
      <span class="p-float-label">
        <Calendar inputId="startdate" v-model="queryStore.startDate" dateFormat="mm/dd/yyyy" :showIcon="true" />
        <label for="startdate">Start date</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2 mb-0 align-self-end">
      <span class="p-float-label">
        <Calendar inputId="enddate" v-model="queryStore.endDate" dateFormat="mm/dd/yyyy" :showIcon="true" />
        <label for="enddate">End date</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2 mb-0 align-self-end">
      <Button class="right-0" :label="queryStore.selectedUsers.length ? 'Submit query' : 'Select users to enable query'"
        icon="pi pi-search" @click="queryStore.getRuns"
        :loading="!queryStore.usersReady || queryStore.selectedUsers.length === 0"
        :disabled="!queryStore.usersReady || queryStore.selectedUsers.length === 0" />
    </div>
  </div>
</template>

<script>
import { onMounted, watch } from 'vue';
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

    watch(selectedRootPath, () => queryStore.getTasks().then(queryStore.getVariants));
    watch([selectedRootPath, selectedTasks, selectedVariants], queryStore.getUsers);

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