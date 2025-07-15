<template>
  <main class="container main w-full">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex flex-column align-items-start mb-2 md:flex-row w-full justify-content-between">
          <div class="flex align-items-center gap-3 mb-4 md:mb-0">
            <div class="admin-page-header mr-4">Groups</div>
            <PvButton
              class="bg-primary text-white border-none p-2 ml-auto"
              data-testid="add-group-btn"
              @click="isAddGroupModalVisible = true"
              >Add Group</PvButton
            >
            <PvButton
              class="bg-primary text-white border-none p-2 ml-auto"
              data-testid="add-users-btn"
              @click="addUsers"
              >Add Users</PvButton
            >
          </div>
          <div class="flex align-items-center justify-content-end w-full md:w-auto">
            <span class="p-input-icon-left p-input-icon-right">
              <i v-if="!searchQuery" class="pi pi-search" />
              <i v-if="searchQuery" class="pi pi-times cursor-pointer" @click="clearSearch" />
              <PvInputText v-model="searchQuery" placeholder="Search groups" class="ml-2 p-inputtext-sm" />
            </span>
          </div>
        </div>
      </div>
      <PvTabView v-if="claimsLoaded" v-model:active-index="activeIndex" lazy class="mb-7">
        <PvTabPanel v-for="orgType in orgHeaders" :key="orgType" :header="orgType.header">
          <div class="grid column-gap-3 mt-2">
            <div
              v-if="activeOrgType === 'schools' || activeOrgType === 'classes' || activeOrgType === 'groups'"
              class="col-12 md:col-6 lg:col-3 xl:col-3 mt-3"
            >
              <PvFloatLabel>
                <PvSelect
                  v-model="selectedDistrict"
                  input-id="district"
                  :options="allDistricts"
                  option-label="name"
                  option-value="id"
                  :loading="isLoadingDistricts"
                  class="w-full"
                  data-cy="dropdown-parent-district"
                />
                <label for="district">Sites</label>
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
                  :loading="isLoadingSchools"
                  class="w-full"
                  data-cy="dropdown-parent-school"
                />
                <label for="school">School</label>
              </PvFloatLabel>
            </div>
          </div>
          <RoarDataTable
            :key="tableKey"
            :columns="tableColumns"
            :data="filteredTableData ?? []"
            sortable
            :loading="isTableLoading"
            :allow-filtering="false"
            @export-all="exportAll"
            @selected-org-id="showCode"
            @export-org-users="(orgId) => exportOrgUsers(orgId)"
            @edit-button="onEditButtonClick($event)"
            @assignments-button="onAssignmentsButtonClick($event)"
          />
        </PvTabPanel>
      </PvTabView>
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
            class="bg-primary border-none p-2 text-white hover:bg-red-900 font-normal"
            @click="copyToClipboard(`https://roar.education/register/?code=${activationCode}`)"
          >
            <i class="pi pi-copy p-2"></i>
          </PvButton>
        </PvInputGroup>
        <p class="font-bold text-lg">Code:</p>
        <PvInputGroup class="mt-3">
          <PvInputText
            style="width: 70%"
            :value="activationCode"
            autocomplete="off"
            data-cy="input-text-activation-code"
            readonly
          />
          <PvButton
            class="bg-primary border-none p-2 text-white hover:bg-red-900"
            data-cy="button-copy-invitation"
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
  <RoarModal
    title="Edit Group"
    subtitle="Modify or add Group information"
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

  <AddGroupModal :isVisible="isAddGroupModalVisible" @close="isAddGroupModalVisible = false" />

  <GroupAssignmentsModal
    :is-visible="isAssignmentsModalVisible"
    :org-id="selectedOrgId"
    :org-name="selectedOrgName"
    :org-type="activeOrgType"
    :all-administrations="allAdministrations"
    :is-loading="isLoadingAdministrations"
    @close="closeAssignmentsModal"
  />
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch, watchEffect } from 'vue';
import * as Sentry from '@sentry/vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import PvSelect from 'primevue/select';
import PvInputGroup from 'primevue/inputgroup';
import PvInputText from 'primevue/inputtext';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import _get from 'lodash/get';
import _head from 'lodash/head';
import _kebabCase from 'lodash/kebabCase';
import _debounce from 'lodash/debounce';
import { useAuthStore } from '@/store/auth';
import { orgFetchAll } from '@/helpers/query/orgs';
import { fetchUsersByOrg, countUsersByOrg } from '@/helpers/query/users';
import { getAdministrationsByOrg } from '@/helpers/query/administrations';
import { orderByDefault, exportCsv, fetchDocById } from '@/helpers/query/utils';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useOrgsTableQuery from '@/composables/queries/useOrgsTableQuery';
import useAdministrationsListQuery from '@/composables/queries/useAdministrationsListQuery';
import EditOrgsForm from '@/components/EditOrgsForm.vue';
import RoarModal from '@/components/modals/RoarModal.vue';
import { CSV_EXPORT_MAX_RECORD_COUNT } from '@/constants/csvExport';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import RoarDataTable from '@/components/RoarDataTable.vue';
import PvFloatLabel from 'primevue/floatlabel';
import AddGroupModal from '@/components/modals/AddGroupModal.vue';
import GroupAssignmentsModal from '@/components/modals/GroupAssignmentsModal.vue';

const router = useRouter();
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
const searchQuery = ref('');
const sanitizedSearchString = ref('');

const updateSanitizedSearch = _debounce((value) => {
  sanitizedSearchString.value = value;
}, 300);

watch(searchQuery, (newValue) => {
  updateSanitizedSearch(newValue);
});

const clearSearch = () => {
  searchQuery.value = '';
  sanitizedSearchString.value = '';
};
const isAddGroupModalVisible = ref(false);
const isAssignmentsModalVisible = ref(false);
const selectedOrgId = ref('');
const selectedOrgName = ref('');

const addUsers = () => {
  router.push({ name: 'Add Users' });
};

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);
const adminOrgs = computed(() => userClaims?.value?.claims?.adminOrgs);

const orgHeaders = computed(() => {
  return {
    districts: { header: 'Sites', id: 'districts' },
    schools: { header: 'Schools', id: 'schools' },
    classes: { header: 'Classes', id: 'classes' },
    groups: { header: 'Cohorts', id: 'groups' },
  };
});

const activeIndex = ref(0);
const activeOrgType = computed(() => {
  return Object.keys(orgHeaders.value)[activeIndex.value];
});

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

// Fetch all administrations for the assignments modal
const { 
  data: allAdministrations, 
  isLoading: isLoadingAdministrations,
  isFetching: isFetchingAdministrations 
} = useAdministrationsListQuery(orderBy, false, {
  enabled: claimsLoaded,
});

// Filtered org data based on selected cohort site
const filteredOrgData = computed(() => {
  if (activeOrgType.value !== 'groups' || !selectedDistrict.value || !orgData.value) {
    return orgData.value;
  }

  return orgData.value.filter((org) => org.parentOrgId === selectedDistrict.value);
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

/**
 * Exports users of a given organization type to a CSV file.
 *
 * @NOTE In order to avoid overly large exports, the function will allow exports up to a predefined limit (currently
 * 10,000 records). To avoid running a large and potentially unecessary query, we first run an aggregation query to
 * verify that the export is within the limit.
 *
 * @TODO Replace this logic with a server driven export, for example a cloud function that generate a download link for
 * the user, effectively allowing complete and large exports.
 *
 * @param {Object} orgType - The organization type object.
 * @param {string} orgType.id - The ID of the organization type.
 * @param {string} orgType.name - The name of the organization type.
 *
 * @returns {Promise<void>} - A promise that resolves when the export is complete.
 */
const exportOrgUsers = async (orgType) => {
  try {
    // First, count the users
    const userCount = await countUsersByOrg(activeOrgType.value, orgType.id, orderBy);

    if (userCount === 0) {
      toast.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: 'No users found for the organization.',
        life: 3000,
      });
      return;
    }

    if (userCount > CSV_EXPORT_MAX_RECORD_COUNT) {
      toast.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: 'Too many users to export. Please filter the users by selecting a smaller org type.',
        life: 3000,
      });
      return;
    }

    // Fetch the users if the count is within acceptable limits
    const users = await fetchUsersByOrg(activeOrgType.value, orgType.id, userCount, ref(0), orderBy);

    const computedExportData = users.map((user) => ({
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      FirstName: _get(user, 'name.first'),
      LastName: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
      Gender: _get(user, 'studentData.gender'),
      DateOfBirth: _get(user, 'studentData.dob'),
      UserType: _get(user, 'userType'),
      ell_status: _get(user, 'studentData.ell_status'),
      iep_status: _get(user, 'studentData.iep_status'),
      frl_status: _get(user, 'studentData.frl_status'),
      race: _get(user, 'studentData.race'),
      hispanic_ethnicity: _get(user, 'studentData.hispanic_ethnicity'),
      home_language: _get(user, 'studentData.home_language'),
    }));

    // ex. cypress-test-district-users-export.csv
    exportCsv(computedExportData, `${_kebabCase(orgType.name)}-users-export.csv`);

    toast.add({
      severity: 'success',
      summary: 'Export Successful',
      detail: 'Users have been exported successfully!',
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export Failed',
      detail: error.message,
      life: 3000,
    });
    Sentry.captureException(error);
  }
};

const tableColumns = computed(() => {
  const columns = [
    {
      field: 'name',
      header: 'Name',
      dataType: 'string',
      pinned: true,
      sort: true,
    },
  ];

  if (['districts', 'schools'].includes(activeOrgType.value)) {
    columns.push();
  }

  columns.push({
    header: 'Users',
    link: true,
    routeName: 'ListUsers',
    routeTooltip: 'View users',
    routeLabel: 'Users',
    routeIcon: 'pi pi-user',
    sort: false,
  });

  // Add Assignments column for all org types
  columns.push({
    header: 'Assignments',
    button: true,
    eventName: 'assignments-button',
    buttonIcon: 'pi pi-list',
    sort: false,
  });

  columns.push(
    {
      header: 'Edit',
      button: true,
      eventName: 'edit-button',
      buttonIcon: 'pi pi-pencil',
      sort: false,
    },
    // {
    //   header: 'Export Users',
    //   buttonLabel: 'Export Users',
    //   button: true,
    //   eventName: 'export-org-users',
    //   buttonIcon: 'pi pi-download mr-2',
    //   sort: false,
    // },
  );

  return columns;
});

const tableData = ref([]);
const isProcessingData = ref(false);

const isTableLoading = computed(() => {
  return isLoading.value || isFetching.value || isLoadingAdministrations.value || isFetchingAdministrations.value || isProcessingData.value;
});

watchEffect(async () => {
  // Wait for both queries to be ready
  if (isLoading.value || isLoadingAdministrations.value) {
    tableData.value = [];
    return;
  }

  // Only process if we have both org data and administrations data
  if (!filteredOrgData.value || !allAdministrations.value) {
    return;
  }

  isProcessingData.value = true;
  
  try {
    const mappedData = await Promise.all(
      filteredOrgData.value.map(async (org) => {
        const userCount = await countUsersByOrg(activeOrgType.value, org.id);
        const assignmentCount = getAdministrationsByOrg(
          org.id,
          activeOrgType.value,
          allAdministrations.value,
        ).length;
        return {
          ...org,
          userCount,
          assignmentCount,
          routeParams: {
            orgType: activeOrgType.value,
            orgId: org.id,
            orgName: org?.name || '_',
            tooltip: 'View Users in ' + org?.name || '',
          },
        };
      }),
    );

    tableData.value = mappedData;
  } finally {
    isProcessingData.value = false;
  }
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

const onAssignmentsButtonClick = (event) => {
  selectedOrgId.value = _get(event, 'id', '');
  selectedOrgName.value = _get(event, 'name', '');
  isAssignmentsModalVisible.value = true;
};

const closeAssignmentsModal = () => {
  isAssignmentsModalVisible.value = false;
  selectedOrgId.value = '';
  selectedOrgName.value = '';
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

onUnmounted(() => {
  // Cleanup subscriptions and reset state
  if (unsubscribe) {
    unsubscribe();
  }

  // Reset modal states
  isAssignmentsModalVisible.value = false;
  selectedOrgId.value = '';
  selectedOrgName.value = '';

  // Reset other states
  isEditModalEnabled.value = false;
  currentEditOrgId.value = null;
  isDialogVisible.value = false;
});

watchEffect(() => {
  selectedDistrict.value = _get(_head(allDistricts.value), 'id');
});

watch(allSchools, (newValue) => {
  selectedSchool.value = _get(_head(newValue), 'id');
});

const tableKey = ref(0);
watch([selectedDistrict, selectedSchool], () => {
  tableKey.value += 1;
});

const filteredTableData = computed(() => {
  if (!tableData.value || !sanitizedSearchString.value) {
    return tableData.value;
  }

  const query = sanitizedSearchString.value.toLowerCase().trim();
  return tableData.value.filter((item) => {
    // Filter by name
    if (item.name && item.name.toLowerCase().includes(query)) {
      return true;
    }

    // Filter by tags if they exist
    if (item.tags && Array.isArray(item.tags)) {
      return item.tags.some((tag) => tag.toLowerCase().includes(query));
    }

    return false;
  });
});
</script>

<style lang="scss">
.p-datatable-scrollable .p-datatable-frozen-column {
  position: inherit !important;
}
</style>
