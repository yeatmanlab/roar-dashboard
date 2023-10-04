<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <TabView v-model:activeIndex="activeIndex">
        <TabPanel v-for="orgType in orgData" :header="orgType.header">
          <button v-tooltip.top="'Refresh'" class="p-panel-header-icon mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
          <div class="grid column-gap-3 mt-3">
            <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3" v-if="orgType.id === 'schools' || orgType.id === 'classes'">
              <span class="p-float-label">
                <Dropdown v-model="selectedDistrict" inputId="district" :options="orgData.districts.data" showClear optionLabel="name"
                  placeholder="Select a district" class="w-full" />
                <label for="district">District</label>
              </span>
            </div>
            <div class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3" v-if="orgType.id === 'classes'">
              <span class="p-float-label">
                <Dropdown v-model="selectedSchool" inputId="school" :options="orgData.schools.data" showClear optionLabel="name"
                  placeholder="Select a school" class="w-full" />
                <label for="school">School</label>
              </span>
            </div>
          </div>
          <SkeletonTable v-if="isFetching" />
          <RoarDataTable :columns="tableColumns" :data="tableData" :key="tableKey" v-if="tableData.length && !isFetching" @page="handlePageEvent($event)"/>
          <div v-else-if="!isFetching">No data!</div>
        </TabPanel>
      </TabView>
    </section>
  </main>
</template>
<script setup>
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import SkeletonTable from "@/components/SkeletonTable.vue";
import { getSidebarActions } from "../router/sidebarActions";
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useAuthStore } from "@/store/auth";
import { useQueryStore } from "@/store/query";
import { storeToRefs } from "pinia";
import _forEach from 'lodash/forEach'
import _isEmpty from 'lodash/isEmpty'
import _head from 'lodash/head'
import _get from 'lodash/get'

// const showTable = ref(false);
const tableKey = ref(0);
const orgData = ref({
  districts: { header: "Districts", id: 'districts', data: [] },
  schools: { header: "Schools", id: 'schools',  data: [] },
  classes: { header: "Classes", id: 'classes', data: [] },
  groups: { header: "Groups", id: 'groups', data: [] },
})
const activeIndex = ref(0);

// Authstore and Sidebar
const authStore = useAuthStore();
const queryStore = useQueryStore();
const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

// Refresh actions
const refreshing = ref(false);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

let unsubscribe;

const refresh = async () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();
  
  let districtsData = await queryStore.getOrgs('districts')
  refreshing.value = false;
  console.log('districts', districtsData)
  orgData.value.districts.data = districtsData
  tableData.value = districtsData
  // showTable.value = true;
  tableKey.value = tableKey.value +1;
  isFetching.value = false;
}

const isFetching = ref(true);

// Call refresh in onMounted hook
const { roarfirekit } = storeToRefs(authStore);
onMounted(async () => {
  if (roarfirekit.value.getOrgs && roarfirekit.value.isAdmin()) {
    await refresh()
  }
})

const tableColumns = ref([
  { field: 'name', header: 'District Name', dataType: 'string'}
])

const tableData = ref([])
const selectedDistrict = ref({})
const selectedSchool = ref({})

async function refreshOrgs(orgType, orgIds) {
  console.log('refresh orgs called')
  isFetching.value = true
  const newOrgs = await queryStore.getOrgsById(orgType, orgIds);
  console.log(`new ${orgType}:`, newOrgs)
  orgData.value[orgType].data = newOrgs
  tableData.value = newOrgs;
  tableKey.value = tableKey.value + 1;
  isFetching.value = false;
}

watch([selectedDistrict, selectedSchool], async ([newDistrict, newSchool], [oldDistrict, oldSchool]) => {
  console.log('watcher changed!')
  console.log('new district:', newDistrict.name)
  if(newDistrict !== oldDistrict){
    // If district actually changed
    const newSchools = _get(newDistrict, 'schools')
    if(newSchools) {
      await refreshOrgs('schools', newSchools)
    } else {
      tableData.value = []
      tableKey.value = tableKey.value + 1;
    }
  }
  if(newSchool !== oldSchool) {
    console.log('grabbing new classes. please hold...')
    const newClasses = _get(newSchool, 'classes')
    if(newClasses) {
      await refreshOrgs('classes', newClasses);
    } else {
      tableData.value = [];
      tableKey.value = tableKey.value + 1
    }
    console.log('classes callback finished.')
  }
  if(activeIndex.value === 2 && _isEmpty(selectedSchool.value)) {
    // console.log('youre viewing classes, and that is currently', selectedSchool.value)
    selectedSchool.value = _head(orgData.value.schools.data)
    // console.log('now, schools are', orgData.value.schools.data)
  }
})

watch(activeIndex, async (newIndex, oldIndex) => {
  // 0: districts
  // 1: schools
  // 2: classes
  // 3: groups
  if(newIndex === 0){
    console.log('Now viewing districts.')
    tableData.value = orgData.value.districts.data
    tableKey.value = tableKey.value + 1
    isFetching.value = false;
  }
  if(newIndex === 1){
    console.log('Now viewing schools.')
    if(_isEmpty(selectedDistrict.value)) {
      console.log('selected district is empty.')
      selectedDistrict.value = _head(orgData.value.districts.data)
    }
    const newSchools = _get(selectedDistrict.value, 'schools');
    if(newSchools) await refreshOrgs('schools', newSchools);
  }
  if(newIndex === 2){
    console.log('Now viewing classes.')
    if(_isEmpty(selectedDistrict.value)) {
      const schoolData = _head(orgData.value.districts.data)
      selectedDistrict.value = schoolData
    }
    if(_isEmpty(selectedSchool.value)) {
      console.log('seleted school is empty.')
      selectedSchool.value = _head(orgData.value.schools.data)
      console.log('set sel school to ', selectedSchool.value)
    }
    const newClasses = _get(selectedSchool.value, 'classes')
    if(newClasses) await refreshOrgs('classes', newClasses)
  }
  if(newIndex === 3){
    if(_isEmpty(orgData.value.groups.data)){
      isFetching.value = true;
      const groupsData = await queryStore.getOrgs('groups')
      orgData.value.groups.data = groupsData
      tableData.value = groupsData
      isFetching.value = false;
    } else {
      tableData.value = orgData.value.groups.data
    }
    tableKey.value = tableKey.value + 1
  }
})
</script>