<template>
  <PvToast />
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <i class="pi pi-folder-open text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">List Organizations</div>
          </div>
        </div>
        <div class="text-md text-gray-500 ml-6">View organizations asssigned to your account.</div>
      </div>
      <PvTabView v-if="claimsLoaded" v-model:activeIndex="activeIndex" lazy class="mb-7">
        <PvTabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
          <div class="grid column-gap-3 mt-2">
            <div
              v-if="activeOrgType === 'schools' || activeOrgType === 'classes'"
              class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3"
            >
              <span class="p-float-label">
                <PvDropdown
                  v-model="selectedDistrict"
                  input-id="district"
                  :options="allDistricts"
                  option-label="name"
                  option-value="id"
                  :placeholder="districtPlaceholder"
                  :loading="isLoadingDistricts"
                  class="w-full"
                  data-cy="dropdown-parent-district"
                />
                <label for="district">District</label>
              </span>
            </div>
            <div v-if="orgType.id === 'classes'" class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
              <span class="p-float-label">
                <PvDropdown
                  v-model="selectedSchool"
                  input-id="school"
                  :options="allSchools"
                  option-label="name"
                  option-value="id"
                  :placeholder="schoolPlaceholder"
                  :loading="isLoadingSchools"
                  class="w-full"
                  data-cy="dropdown-parent-school"
                />
                <label for="school">School</label>
              </span>
            </div>
          </div>
          <RoarDataTable
            v-if="tableData"
            :key="tableKey"
            :columns="tableColumns"
            :data="tableData"
            sortable
            :loading="isLoading || isFetching"
            :allow-filtering="false"
            @export-all="exportAll"
            @selected-org-id="showCode"
          />
          <AppSpinner v-else />
        </PvTabPanel>
      </PvTabView>
      <AppSpinner v-else />
    </section>
    <section class="flex mt-8 justify-content-end">
      <PvDialog
        v-model:visible="isDialogVisible"
        dialog-title="text-primary"
        :style="{ width: '50rem' }"
        :draggable="false"
      >
        <template #header>
          <h1 class="text-primary font-bold m-0">Invitation</h1>
        </template>
        <p class="font-bold text-lg">Link:</p>
        <PvInputGroup>
          <PvInputText
            style="width: 70%"
            :value="`https://roar.education/register/?code=${activationCode}`"
            autocomplete="off"
            readonly
          />
          <PvButton
            class="bg-primary border-none p-2 text-white hover:bg-red-900"
            @click="copyToClipboard(`https://roar.education/register/?code=${activationCode}`)"
          >
            <i class="pi pi-copy p-2"></i>
          </PvButton>
        </PvInputGroup>
        <p class="font-bold text-lg">Code:</p>
        <PvInputGroup class="mt-3">
          <PvInputText style="width: 70%" :value="activationCode" autocomplete="off" readonly />
          <PvButton
            class="bg-primary border-none p-2 text-white hover:bg-red-900"
            @click="copyToClipboard(activationCode)"
          >
            <i class="pi pi-copy p-2"></i>
          </PvButton>
        </PvInputGroup>
        <div class="flex justify-content-end">
          <PvButton
            class="mt-3 bg-primary border-none border-round p-3 text-white hover:bg-red-900"
            @click="closeDialog"
            >Close</PvButton
          >
        </div>
      </PvDialog>
    </section>
  </main>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import _get from 'lodash/get';
import _head from 'lodash/head';
import _isEmpty from 'lodash/isEmpty';
import { useAuthStore } from '@/store/auth';
import { orgFetchAll } from '@/helpers/query/orgs';
import { orderByDefault, exportCsv, fetchDocById } from '@/helpers/query/utils';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useDistrictsQuery from '@/composables/queries/useDistrictsQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useOrgsTableQuery from '@/composables/queries/useOrgsTableQuery';

const initialized = ref(false);
const selectedDistrict = ref(undefined);
const selectedSchool = ref(undefined);
const orderBy = ref(orderByDefault);
let activationCode = ref(null);
const isDialogVisible = ref(false);
const toast = useToast();

const districtPlaceholder = computed(() => {
  if (isLoadingDistricts.value) {
    return 'Loading...';
  }
  return 'Select a district';
});

const schoolPlaceholder = computed(() => {
  if (isLoadingSchools.value) {
    return 'Loading...';
  }
  return 'Select a school';
});

// Authstore and Sidebar
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);
const adminOrgs = computed(() => userClaims?.value?.claims?.minimalAdminOrgs);

const orgHeaders = computed(() => {
  const headers = {
    districts: { header: 'Districts', id: 'districts' },
    schools: { header: 'Schools', id: 'schools' },
    classes: { header: 'Classes', id: 'classes' },
    groups: { header: 'Groups', id: 'groups' },
  };

  if (isSuperAdmin.value) return headers;

  const result = {};
  if ((adminOrgs.value?.districts ?? []).length > 0) {
    result.districts = { header: 'Districts', id: 'districts' };
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.schools ?? []).length > 0) {
    result.schools = { header: 'Schools', id: 'schools' };
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.classes ?? []).length > 0) {
    result.classes = { header: 'Classes', id: 'classes' };
  }
  if ((adminOrgs.value?.groups ?? []).length > 0) {
    result.groups = { header: 'Groups', id: 'groups' };
  }
  return result;
});

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value];
});

const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));

const { isLoading: isLoadingDistricts, data: allDistricts } = useDistrictsQuery({
  enabled: claimsLoaded,
});

const schoolQueryEnabled = computed(() => {
  return claimsLoaded.value && !!selectedDistrict.value;
});

const { isLoading: isLoadingSchools, data: allSchools } = useDistrictSchoolsQuery(selectedDistrict, {
  enabled: schoolQueryEnabled,
});

const {
  isLoading,
  isFetching,
  data: orgData,
} = useOrgsTableQuery(activeOrgType, selectedDistrict, selectedSchool, orderBy, {
  enabled: claimsLoaded,
});

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(function () {
      toast.add({
        severity: 'success',
        summary: 'Hoorah!',
        detail: 'Your code has been successfully copied to clipboard!',
        life: 3000,
      });
    })
    .catch(function () {
      toast.add({
        severity: 'error',
        summary: 'Error!',
        detail: 'Your code has not been copied to clipboard! \n Please try again',
        life: 3000,
      });
    });
}

const exportAll = async () => {
  const exportData = await orgFetchAll(
    activeOrgType,
    selectedDistrict,
    selectedSchool,
    orderBy,
    isSuperAdmin,
    adminOrgs,
  );
  exportCsv(exportData, `roar-${activeOrgType.value}.csv`);
};

const tableColumns = computed(() => {
  const columns = [
    { field: 'name', header: 'Name', dataType: 'string', pinned: true, sort: true },
    { field: 'abbreviation', header: 'Abbreviation', dataType: 'string', sort: true },
    { field: 'address.formattedAddress', header: 'Address', dataType: 'string', sort: true },
    { field: 'tags', header: 'Tags', dataType: 'array', chip: true, sort: false },
  ];

  if (['districts', 'schools'].includes(activeOrgType.value)) {
    columns.push(
      { field: 'mdrNumber', header: 'MDR Number', dataType: 'string', sort: false },
      { field: 'ncesId', header: 'NCES ID', dataType: 'string', sort: false },
    );
  }

  if (['districts', 'schools', 'classes'].includes(activeOrgType.value)) {
    columns.push({ field: 'clever', header: 'Clever', dataType: 'boolean', sort: false });
    columns.push({ field: 'classlink', header: 'ClassLink', dataType: 'boolean', sort: false });
  }

  columns.push(
    {
      link: true,
      routeName: 'ListUsers',
      routeTooltip: 'View users',
      routeLabel: 'Users',
      routeIcon: 'pi pi-user',
      sort: false,
    },
    {
      header: 'SignUp Code',
      buttonLabel: 'Invite Users',
      button: true,
      eventName: 'selected-org-id',
      buttonIcon: 'pi pi-send mr-2',
      sort: false,
    },
  );

  return columns;
});

const tableData = computed(() => {
  if (isLoading.value) return [];
  return orgData.value.map((org) => {
    return {
      ...org,
      routeParams: {
        orgType: activeOrgType.value,
        orgId: org.id,
        orgName: org.name,
        tooltip: 'View Users in ' + org.name,
      },
    };
  });
});

const showCode = async (selectedOrg) => {
  const orgInfo = await fetchDocById(activeOrgType.value, selectedOrg.id);
  if (orgInfo?.currentActivationCode) {
    activationCode.value = orgInfo.currentActivationCode;
    isDialogVisible.value = true;
  }
};

const closeDialog = () => {
  isDialogVisible.value = false;
};

let unsubscribe;
const initTable = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) initTable();
});

watch(allDistricts, (newValue) => {
  selectedDistrict.value = _get(_head(newValue), 'id');
});

watch(allSchools, (newValue) => {
  selectedSchool.value = _get(_head(newValue), 'id');
});

const tableKey = ref(0);
watch([selectedDistrict, selectedSchool], () => {
  tableKey.value += 1;
});
</script>
