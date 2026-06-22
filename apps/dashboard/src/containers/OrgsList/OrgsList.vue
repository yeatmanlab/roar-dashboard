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
    <!--
      Key on (orgType, orgId) so the form remounts whenever either changes. The
      modal host (RoarModal) stays mounted, so without this the form would
      capture the org type at its first mount and dispatch a stale by-id read
      after a tab switch. Remounting also resets local form state per open.
    -->
    <EditOrgsForm
      :key="`${activeOrgType}:${currentEditOrgId}`"
      :org-id="currentEditOrgId"
      :org-type="activeOrgType"
      @update:org-data="localOrgData = $event"
    />
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
import { StatusCodes } from 'http-status-codes';
import { useToast } from 'primevue/usetoast';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvInputGroup from 'primevue/inputgroup';
import PvInputText from 'primevue/inputtext';
import PvTabPanel from 'primevue/tabpanel';
import PvTabView from 'primevue/tabview';
import PvToast from 'primevue/toast';
import _get from 'lodash/get';
import _head from 'lodash/head';
import _cloneDeep from 'lodash/cloneDeep';
import { useAuthStore } from '@/store/auth';
import { getRoarApiClient } from '@/clients/roar-api';
import { orderByDefault, exportCsv } from '@/helpers/query/utils';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useSchoolClassesQuery from '@/composables/queries/useSchoolClassesQuery';
import useGroupsListQuery from '@/composables/queries/useGroupsListQuery';
import EditOrgsForm from '@/components/EditOrgsForm.vue';
import RoarModal from '@/components/modals/RoarModal.vue';
import Dialog from '@/components/Dialog';
import OrgExportModal from './components/OrgExportModal.vue';
import { useOrgExportOrchestrator } from './composables/useOrgExportOrchestrator';
import { useOrgTableColumns } from './composables/useOrgTableColumns';
import useUpdateOrgMutation from '@/composables/mutations/useUpdateOrgMutation';
import { parseGooglePlaceToLocation } from '@/helpers/parseGooglePlaceToLocation';
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
const { userCan, Permissions } = usePermissions();
const { mutateAsync: updateOrg } = useUpdateOrgMutation();

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

// The Families tab was intentionally dropped during the ts-rest backend
// migration — families have no list endpoint and aren't admin-managed here.
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

// Table data is sourced from the same migrated, page-walking composables that
// back OrgPicker — one per org type. Each composable walks the backend
// pagination and returns the full set (equivalent to the legacy
// page-size-100000 fetch), so the table never needs server-side pagination.
const {
  isLoading: isLoadingDistricts,
  isFetching: isFetchingDistricts,
  data: allDistricts,
} = useDistrictsListQuery({
  enabled: claimsLoaded,
});

const schoolQueryEnabled = computed(() => {
  return claimsLoaded.value && !!selectedDistrict.value;
});

const {
  isLoading: isLoadingSchools,
  isFetching: isFetchingSchools,
  data: allSchools,
} = useDistrictSchoolsQuery(selectedDistrict, {
  enabled: schoolQueryEnabled,
});

const classQueryEnabled = computed(() => {
  return claimsLoaded.value && !!selectedSchool.value;
});

const {
  isLoading: isLoadingClasses,
  isFetching: isFetchingClasses,
  data: allClasses,
} = useSchoolClassesQuery(selectedSchool, {
  enabled: classQueryEnabled,
});

// Gated to the Groups tab (in addition to the composable's internal token gate)
// so the list isn't fetched while the user is on another tab — mirrors OrgPicker.
const groupsQueryEnabled = computed(() => {
  return claimsLoaded.value && activeOrgType.value === ORG_TYPES.GROUPS;
});

const {
  isLoading: isLoadingGroups,
  isFetching: isFetchingGroups,
  data: allGroups,
} = useGroupsListQuery({
  enabled: groupsQueryEnabled,
});

// The org set backing the active tab's table. Each underlying composable only
// fetches once its parent id / token is available, so this stays minimal —
// districts and schools reuse the data already fetched for the selectors.
const orgData = computed(() => {
  switch (activeOrgType.value) {
    case ORG_TYPES.DISTRICTS:
      return allDistricts.value ?? [];
    case ORG_TYPES.SCHOOLS:
      return allSchools.value ?? [];
    case ORG_TYPES.CLASSES:
      return allClasses.value ?? [];
    case ORG_TYPES.GROUPS:
      return allGroups.value ?? [];
    default:
      return [];
  }
});

// Loading / fetching state for the active tab's underlying query, so the table
// spinner reflects only the query that feeds it.
const isLoading = computed(() => {
  switch (activeOrgType.value) {
    case ORG_TYPES.DISTRICTS:
      return isLoadingDistricts.value;
    case ORG_TYPES.SCHOOLS:
      return isLoadingSchools.value;
    case ORG_TYPES.CLASSES:
      return isLoadingClasses.value;
    case ORG_TYPES.GROUPS:
      return isLoadingGroups.value;
    default:
      return false;
  }
});

const isFetching = computed(() => {
  switch (activeOrgType.value) {
    case ORG_TYPES.DISTRICTS:
      return isFetchingDistricts.value;
    case ORG_TYPES.SCHOOLS:
      return isFetchingSchools.value;
    case ORG_TYPES.CLASSES:
      return isFetchingClasses.value;
    case ORG_TYPES.GROUPS:
      return isFetchingGroups.value;
    default:
      return false;
  }
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

const tableData = computed(() => {
  if (isLoading.value) return [];
  const tableData = orgData?.value?.map((org) => {
    const orgInfo = _cloneDeep(org);
    return {
      ...orgInfo,
      isExporting: exportingOrgId.value === org.id,
      routeParams: {
        orgType: activeOrgType.value,
        orgId: org.id,
        orgName: org.name,
        tooltip: 'View Users in ' + org.name,
      },
    };
  });
  return tableData;
});

// The org-data computed already holds the full set for the active tab (the
// migrated composables walk every page), so the CSV is built from that rather
// than re-fetching. Export the raw mapped org rows — not `tableData`, which
// injects UI-only keys (`isExporting`, `routeParams`) that shouldn't leak to CSV.
const exportAll = () => {
  exportCsv(orgData.value ?? [], `roar-${activeOrgType.value}.csv`);
};

// Invitation (activation) codes were intentionally dropped for districts,
// schools, and classes during the ts-rest backend migration — only groups
// expose an invitation-code endpoint. The SignUp Code action is gated to the
// Groups tab, so this only fires for groups; the org-type guard is a defensive
// backstop in case a non-group action ever reaches here.
const showCode = async (selectedOrg) => {
  if (activeOrgType.value !== ORG_TYPES.GROUPS) return;

  try {
    const res = await getRoarApiClient().groups.getInvitationCode({
      params: { groupId: selectedOrg.id },
    });

    if (res.status === StatusCodes.OK) {
      activationCode.value = res.body.data.code;
      isDialogVisible.value = true;
      return;
    }

    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'No invitation code',
      detail: 'No valid invitation code is available for this group.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  } catch (error) {
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Unexpected error',
      detail: `Failed to fetch the invitation code: ${error.message}`,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    Sentry.captureException(error);
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

/**
 * Build the PATCH body for an org update, including only the fields that are
 * valid for the given org type (per each resource's `Update<Resource>Request`
 * schema) and only when present/changed.
 *
 * - `name`: sent for every org type when present.
 * - `abbreviation`: districts, schools, and groups only — classes have no
 *   abbreviation column, so it is never sent for them.
 * - `location`: districts, schools, and groups only, and only when the user
 *   picked a new address (`localOrgData.address` is the object `setAddress`
 *   builds). It is converted to the backend's structured `location` shape via
 *   `parseGooglePlaceToLocation`. Classes are excluded because their `location`
 *   is a free-text room label (a string), not a structured address object.
 * - `identifiers.ncesId`: districts and schools only, when present.
 *
 * The retired `tags`, `testData`, and `demoData` fields are never sent.
 *
 * @param {string} orgType - The active (plural) org type.
 * @param {Object} orgData - The edited local org data from EditOrgsForm.
 * @returns {Object} The PATCH body for the resource's update endpoint.
 */
const buildOrgUpdateBody = (orgType, orgData) => {
  const body = {};

  if (orgData?.name) body.name = orgData.name;

  // Abbreviation: every org type except classes.
  if (orgType !== ORG_TYPES.CLASSES && orgData?.abbreviation) {
    body.abbreviation = orgData.abbreviation;
  }

  // Structured location: only for org types whose location is an address
  // object (districts, schools, groups), and only when the user picked a new
  // place. Classes carry a free-text location string, so they are excluded.
  const supportsStructuredLocation =
    orgType === ORG_TYPES.DISTRICTS || orgType === ORG_TYPES.SCHOOLS || orgType === ORG_TYPES.GROUPS;
  if (supportsStructuredLocation && orgData?.address) {
    const location = parseGooglePlaceToLocation(orgData.address);
    if (Object.keys(location).length > 0) body.location = location;
  }

  // NCES identifier: districts only. The edit form only surfaces the NCES input
  // for districts (`showNcesId`), so sending it for schools would silently
  // re-submit a seeded value the user never saw or touched.
  if (orgType === ORG_TYPES.DISTRICTS && orgData?.ncesId) {
    body.identifiers = { ncesId: orgData.ncesId };
  }

  return body;
};

const updateOrgData = async () => {
  const body = buildOrgUpdateBody(activeOrgType.value, localOrgData.value);

  // Nothing the form can edit changed — close without firing a no-op PATCH (an
  // empty body would otherwise be rejected by the strict update schema).
  if (Object.keys(body).length === 0) {
    closeEditModal();
    return;
  }

  isSubmitting.value = true;
  try {
    await updateOrg({ orgType: activeOrgType.value, orgId: currentEditOrgId.value, body });
    closeEditModal();
    toast.add({
      severity: TOAST_SEVERITIES.SUCCESS,
      summary: 'Updated',
      detail: 'Organization data updated successfully!',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  } catch (error) {
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Unexpected error',
      detail: `Unexpected error occurred: ${error.message}`,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    Sentry.captureException(error);
  } finally {
    isSubmitting.value = false;
  }
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
