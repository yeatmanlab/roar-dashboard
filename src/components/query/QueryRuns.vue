<template>
  <div class="p-fluid grid formgrid text-left">
    <div class="field col-12 md:col-6 mt-0">
      <p class="mb-1 mt-0 mx-1">Choose the database to query</p>
      <div class="p-inputgroup">
        <span class="p-inputgroup-addon">
          <i class="pi pi-database"></i>
        </span>
        <Dropdown
v-model="selectedRootPath" input-id="rootdoc" :options="rootPaths" option-label="label"
          option-group-label="label" option-group-children="items">
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
        <MultiSelect
v-model="selectedTasks" input-id="tasks" :options="queryStore.tasks" option-label="id"
          :loading="!queryStore.tasksReady" :filter="true" filter-placeholder="Filter tasks" placeholder="Select tasks"
          :selection-limit="10" :max-selected-labels="4" :virtual-scroller-options="{ itemSize: 40 }" />
      </div>
    </div>

    <div class="field col-12 md:col-6 align-self-end">
      <p class="mb-1 mt-0 mx-1">Select variants</p>
      <div class="p-inputgroup">
        <span class="p-inputgroup-addon">
          <i class="pi pi-angle-double-right"></i>
        </span>
        <MultiSelect
v-model="selectedVariants" input-id="variants" :options="queryStore.variants" option-label="name"
          option-group-label="task" option-group-children="items" :loading="!queryStore.variantsReady" :filter="true"
          filter-placeholder="Filter variants"
          :placeholder="queryStore.variantsReady ? 'Select variants' : 'Choose tasks first to load available variants'"
          :selection-limit="10" :max-selected-labels="4" :virtual-scroller-options="{ itemSize: 40 }" />
      </div>
    </div>

    <div v-if="queryStore.selectedTasks.length === 0" class="field col-12 md:col-12 m-0 p-0">
      <Message severity="warn" class="text-left m-0" :closable="false">
        Select tasks above to enable to following query fields.
      </Message>
    </div>

    <div class="field col-12 md:col-6 mt-2">
      <span class="p-float-label">
        <MultiSelect
v-model="queryStore.selectedUsers" input-id="roaruids" :options="queryStore.users"
          option-label="roarUid" :loading="!queryStore.usersReady" :filter="true" filter-placeholder="Filter ROAR UIDs"
          :max-selected-labels="5" :virtual-scroller-options="{ itemSize: 40 }" />
        <label for="roaruids">ROAR UID / PID</label>
      </span>
    </div>

    <div class="field col-12 md:col-6 mt-2">
      <span class="p-float-label">
        <MultiSelect
v-model="queryStore.selectedGroups" input-id="groups" :options="queryStore.groups" option-label="id"
          :loading="!queryStore.usersReady" :max-selected-labels="4" />
        <label for="groups">Groups</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2">
      <span class="p-float-label">
        <MultiSelect
v-model="queryStore.selectedDistricts" input-id="districts" :options="queryStore.districts"
          option-label="id" :loading="!queryStore.usersReady" :max-selected-labels="4" />
        <label for="districts">Districts</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2">
      <span class="p-float-label">
        <MultiSelect
v-model="queryStore.selectedSchools" input-id="schools" :options="queryStore.schools" option-label="id"
          :loading="!queryStore.usersReady" :max-selected-labels="4" />
        <label for="schools">Schools</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2">
      <span class="p-float-label">
        <MultiSelect
v-model="queryStore.selectedClasses" input-id="classes" :options="queryStore.classes" option-label="id"
          :loading="!queryStore.usersReady" :max-selected-labels="4" />
        <label for="classes">Classes</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2 mb-0 align-self-end">
      <span class="p-float-label">
        <Calendar v-model="queryStore.startDate" input-id="startdate" date-format="mm/dd/yyyy" :show-icon="true" />
        <label for="startdate">Start date</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2 mb-0 align-self-end">
      <span class="p-float-label">
        <Calendar v-model="queryStore.endDate" input-id="enddate" date-format="mm/dd/yyyy" :show-icon="true" />
        <label for="enddate">End date</label>
      </span>
    </div>

    <div class="field col-12 md:col-4 mt-2 mb-0 align-self-end">
      <Button
class="right-0" :label="queryStore.selectedUsers.length ? 'Submit query' : 'Select users to enable query'"
        icon="pi pi-search" :loading="!queryStore.usersReady || queryStore.selectedUsers.length === 0"
        :disabled="!queryStore.usersReady || queryStore.selectedUsers.length === 0"
        @click="queryStore.getRuns" />
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