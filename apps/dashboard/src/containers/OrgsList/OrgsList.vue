<template>
  <PvToast />
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <i class="pi pi-folder-open text-gray-400 rounded text-2xl" />
            <div class="admin-page-header">List Organizations</div>
          </div>
        </div>
        <div class="text-md text-gray-500 ml-6">View organizations assigned to your account.</div>
      </div>
      <PvTabView
        v-if="claimsLoaded"
        v-model:active-index="activeIndex"
        lazy
        class="mb-7"
        data-cy="orgs-list"
        pt:title:data-testid="tab-title__title"
      >
        <PvTabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
          <div class="grid column-gap-3 mt-2">
            <div
              v-if="activeOrgType === 'schools' || activeOrgType === 'classes'"
              class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3"
            >
              <PvFloatLabel>
                <PvSelect
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
              </PvFloatLabel>
            </div>
            <div v-if="orgType.id === 'classes'" class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3">
              <PvFloatLabel>
                <PvSelect
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
              </PvFloatLabel>
            </div>
          </div>
          <div v-if="activeOrgType === ORG_TYPES.GROUPS" class="mx-2">
            <PvToggleButton
              v-model="hideSubgroups"
              off-label="Hide Subgroups"
              on-label="Show Subgroups"
              class="p-2 rounded"
            />
          </div>
          <RoarDataTable
            v-if="showTable"
            :key="tableKey"
            :columns="tableColumns"
            :data="tableData"
            sortable
            :loading="isLoading || isFetching"
            :allow-filtering="false"
            @export-all="exportAll"
            @show-activation-code="showCode"
            @export-org-users="(orgId) => exportOrgUsers(orgId)"
            @edit-button="onEditButtonClick($event)"
          />
          <AppSpinner v-else-if="!tableData" />
        </PvTabPanel>
      </PvTabView>
      <AppSpinner v-else />
    </section>
    <section class="flex mt-8 justify-content-end">
      <Dialog v-model:visible="isDialogVisible" width="50rem">
        <template #header>
          <h1 class="text-primary font-bold m-0">Invitation</h1>
        </template>
        <p class="font-bold text-lg">Link:</p>
        <PvInputGroup>
          <PvInputText
            class="w-2/3"
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
          <PvInputText
            class="w-2/3"
            :value="activationCode"
            autocomplete="off"
            data-cy="activation-code__input"
            readonly
          />
          <PvButton
            class="bg-primary border-none p-2 text-white hover:bg-red-900"
            data-cy="activation-code__copy"
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
      </Dialog>
    </section>
  </main>
  <RoarModal
    title="Edit Organization"
    subtitle="Modify or add organization information"
    :is-enabled="isEditModalEnabled"
    @modal-closed="closeEditModal"
  >
    <EditOrgsForm :org-id="currentEditOrgId" :org-type="activeOrgType" @update:org-data="localOrgData = $event" />
    <template #footer>
      <div>
        <div class="flex gap-2">
          <PvButton
            tabindex="0"
            class="border-none border-round bg-white text-primary p-2 hover:surface-200"
            text
            label="Cancel"
            outlined
            @click="closeEditModal"
          ></PvButton>
          <PvButton
            tabindex="0"
            class="border-none border-round bg-primary text-white p-2 hover:surface-400"
            label="Save"
            @click="updateOrgData"
            ><i v-if="isSubmitting" class="pi pi-spinner pi-spin"></i
          ></PvButton>
        </div>
      </div>
    </template>
  </RoarModal>
  <OrgExportModal
    v-model:visible="modalState.showExportConfirmation"
    :export-phase="exportPhase"
    :export-warning-level="exportWarningLevel"
    :title="exportModalTitle"
    :message="exportModalMessage"
    :severity="exportModalSeverity"
    @confirm="confirmExport"
    @cancel="cancelExport"
    @request-cancel="requestCancelExport"
  />
  <Dialog v-model:visible="modalState.showNoUsersModal" width="30rem">
    <template #header>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-info-circle text-blue-500 text-2xl"></i>
        <h2 class="m-0 font-bold">No Users Found</h2>
      </div>
    </template>
    <p class="text-center">
      No users found in <strong>{{ modalState.noUsersOrgName }}</strong
      >. There are no users to export.
    </p>
    <template #footer>
      <div class="flex justify-content-end">
        <PvButton
          label="OK"
          severity="primary"
          class="border-none border-round p-2"
          @click="modalState.showNoUsersModal = false"
        />
      </div>
    </template>
  </Dialog>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as Sentry from '@sentry/vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvInputGroup from 'primevue/inputgroup';
import PvInputText from 'primevue/inputtext';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import PvToast from 'primevue/toast';
import PvToggleButton from 'primevue/togglebutton';
import _get from 'lodash/get';
import _head from 'lodash/head';
import { useAuthStore } from '@/store/auth';
import { orgFetchAll } from '@/helpers/query/orgs';
import { orderByDefault, exportCsv, fetchDocById } from '@/helpers/query/utils';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useOrgsTableQuery from '@/composables/queries/useOrgsTableQuery';
import EditOrgsForm from '@/components/EditOrgsForm.vue';
import RoarModal from '@/components/modals/RoarModal.vue';
import Dialog from '@/components/Dialog';
import OrgExportModal from './components/OrgExportModal.vue';
import { useOrgExportOrchestrator } from './composables/useOrgExportOrchestrator';
import { useOrgTableColumns } from './composables/useOrgTableColumns';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts.js';
import RoarDataTable from '@/components/RoarDataTable';
import { ORG_TYPES } from '@/constants/orgTypes';
import { usePermissions } from '@/composables/usePermissions';

const initialized = ref(false);
const selectedDistrict = ref(undefined);
const selectedSchool = ref(undefined);
const orderBy = ref(orderByDefault);
let activationCode = ref(null);
const isDialogVisible = ref(false);
const toast = useToast();
const isEditModalEnabled = ref(false);
const currentEditOrgId = ref(null);
const localOrgData = ref(null);
const isSubmitting = ref(false);
const hideSubgroups = ref(false);
const { userCan, Permissions } = usePermissions();

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
    families: { header: 'Families', id: 'families' },
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
  if ((adminOrgs.value?.families ?? []).length > 0) {
    result.families = { header: 'Families', id: 'families' };
  }
  return result;
});

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value];
});

// Use export orchestrator composable (must be after activeOrgType is defined)
const {
  modalState,
  exportPhase,
  exportWarningLevel,
  exportingOrgId,
  exportOrgUsers,
  confirmExport,
  cancelExport,
  requestCancelExport,
  exportModalTitle,
  exportModalMessage,
  exportModalSeverity,
  EXPORT_PHASE,
} = useOrgExportOrchestrator(activeOrgType, orderBy);

// Use table columns composable (must be after activeOrgType is defined)
const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, Permissions);

const claimsLoaded = computed(() => !!userClaims?.value?.claims);

const { isLoading: isLoadingDistricts, data: allDistricts } = useDistrictsListQuery({
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
        severity: TOAST_SEVERITIES.SUCCESS,
        summary: 'Hoorah!',
        detail: 'Your code has been successfully copied to clipboard!',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
    })
    .catch(function () {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Error!',
        detail: 'Your code has not been copied to clipboard! \n Please try again',
        life: TOAST_DEFAULT_LIFE_DURATION,
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

const tableData = computed(() => {
  if (isLoading.value) return [];
  const tableData = orgData?.value?.map((org) => {
    return {
      ...org,
      isExporting: exportingOrgId.value === org.id,
      routeParams: {
        orgType: activeOrgType.value,
        orgId: org.id,
        orgName: org.name,
        tooltip: 'View Users in ' + org.name,
      },
    };
  });
  if (activeOrgType.value === ORG_TYPES.GROUPS && !hideSubgroups.value) {
    return tableData.filter((org) => !org.parentOrgId && !org.parentOrgType);
  }

  return tableData;
});

const showCode = async (selectedOrg) => {
  const orgInfo = await fetchDocById(activeOrgType.value, selectedOrg.id);
  if (orgInfo?.currentActivationCode) {
    activationCode.value = orgInfo.currentActivationCode;
    isDialogVisible.value = true;
  }
};

const onEditButtonClick = (event) => {
  isEditModalEnabled.value = true;
  currentEditOrgId.value = _get(event, 'id', null);
};

const closeEditModal = () => {
  isEditModalEnabled.value = false;
  currentEditOrgId.value = null;
};

const closeDialog = () => {
  isDialogVisible.value = false;
};

const updateOrgData = async () => {
  isSubmitting.value = true;
  await roarfirekit.value
    .createOrg(
      activeOrgType.value,
      localOrgData.value,
      _get(localOrgData.value, 'testData', false),
      _get(localOrgData.value, 'demoData', false),
      currentEditOrgId.value,
    )
    .then(() => {
      closeEditModal();
      toast.add({
        severity: TOAST_SEVERITIES.SUCCESS,
        summary: 'Updated',
        detail: 'Organization data updated successfully!',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
    })
    .catch((error) => {
      toast.add({
        severity: TOAST_SEVERITIES.ERROR,
        summary: 'Unexpected error',
        detail: `Unexpected error occurred: ${error.message}`,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });
      Sentry.captureException(error);
    })
    .finally(() => {
      isSubmitting.value = false;
    });
};

const showTable = computed(() => !!tableData.value);

let unsubscribe;
const initTable = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) initTable();
});

onMounted(() => {
  if (roarfirekit.value.restConfig?.()) initTable();
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

// Watch for modal close via X button to reset export state
watch(
  () => modalState.value.showExportConfirmation,
  (newValue, oldValue) => {
    // If modal was open and is now closed, and we're not in progress
    if (oldValue && !newValue && exportPhase.value !== EXPORT_PHASE.IN_PROGRESS) {
      cancelExport();
    }
  },
);
</script>
