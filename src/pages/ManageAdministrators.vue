<template>
  <div class="p-5">
    <template v-if="isPageLoading">
      <div class="flex justify-center items-center h-96">
        <LevanteSpinner :size="120" />
      </div>
    </template>

    <template v-else>
      <div class="flex align-items-center gap-2">
        <div class="flex flex-column flex-1">
          <h2 class="admin-page-header m-0">Administrators</h2>
          <span v-if="currentSiteName" class="flex align-items-center gap-1 m-0 mt-1 text-lg text-gray-500">
            <i class="pi pi-building"></i>{{ currentSiteName }}
          </span>
        </div>
        <PermissionGuard :required-role="ROLES.ADMIN">
          <PvButton :disabled="isAdminsLoading || isAdminsFetching || isAdminsRefetching || isAllSitesSelected" @click="isAdministratorModalVisible = true"><i class="pi pi-plus"></i>Add Administrator</PvButton>
        </PermissionGuard>
      </div>

      <div class="m-0 mt-5">
        <RoarDataTable
          key="administrators"
          sortable
          :allow-filtering="false"
          :columns="tableColumns"
          :data="tableData"
          :loading="isAdminsLoading || isAdminsFetching || isAdminsRefetching"
          :row-class="getRowClass"
        />
      </div>

      <AddAdministratorModal
        :data="administrator"
        :is-visible="isAdministratorModalVisible"
        @close="closeAdministratorModal"
        @refetch="adminsRefetch"
      />

      <PvDialog
        v-model:visible="isRemovalVerificationModalVisible"
        modal
        header="Confirm Removal"
        :style="{ width: '32rem' }"
        @hide="closeRemovalVerificationModal"
      >
        <div class="flex flex-column gap-3">
          <p class="text-sm text-gray-600">
            To remove this administrator from the site, type
            <span class="font-semibold text-gray-900">{{ removalTargetLabel }}</span>
            and select Remove. This action cannot be undone.
          </p>

          <div class="flex flex-column gap-2">
            <label class="text-sm font-medium text-gray-700">Administrator name</label>
            <PvInputText
              v-model="removalConfirmationInput"
              autofocus
              placeholder="Type administrator name"
              class="w-full"
            />
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <PvButton
              label="Cancel"
              class="p-button-text"
              severity="secondary"
              :disabled="isRemovingAdministrator"
              @click="closeRemovalVerificationModal"
            />
            <PvButton
              label="Remove"
              severity="danger"
              :loading="isRemovingAdministrator"
              :disabled="!isRemovalConfirmationValid || isRemovingAdministrator"
              @click="executeAdministratorRemoval"
            />
          </div>
        </template>
      </PvDialog>

      <PvConfirmDialog :draggable="false" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { usePermissions } from '@/composables/usePermissions';
import { AdminSubResource } from '@levante-framework/permissions-core';
import AddAdministratorModal from '@/components/modals/AddAdministratorModal.vue';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import RoarDataTable from '@/components/RoarDataTable.vue';
import useAdminsBySiteQuery from '@/composables/queries/useAdminsBySiteQuery';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvConfirmDialog from 'primevue/confirmdialog';
import PvDialog from 'primevue/dialog';
import PvInputText from 'primevue/inputtext';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';
import PermissionGuard from '@/components/PermissionGuard.vue';
import { ROLES } from '@/constants/roles';

interface AdministratorName {
  first?: string;
  middle?: string;
  last?: string;
}

interface AdministratorRole {
  role: string;
  siteId: string;
  siteName: string;
}

interface AdministratorOrganizations {
  districts?: string[];
  schools?: string[];
  classes?: string[];
  groups?: string[];
  families?: string[];
}

interface AdministratorRecord {
  id: string;
  email?: string;
  name?: AdministratorName;
  roles?: AdministratorRole[];
  adminOrgs?: AdministratorOrganizations;
  createdAt?: string;
  [key: string]: unknown;
}

interface AdministratorAction {
  name: string;
  tooltip: string;
  icon: string;
  callback: () => void;
}

interface AdministratorTableRow extends AdministratorRecord {
  fullName: string;
  actions: AdministratorAction[];
  isCurrentUser: boolean;
}

const authStore = useAuthStore();
const { currentSite, currentSiteName, roarfirekit } = storeToRefs(authStore);
const { can, permissionsLoaded } = usePermissions();
const confirm = useConfirm();
const toast = useToast();

const administrator = ref<AdministratorRecord | null>(null);
const isAdministratorModalVisible = ref(false);
const isRemovalVerificationModalVisible = ref(false);
const removalConfirmationInput = ref('');
const isRemovingAdministrator = ref(false);

const isAllSitesSelected = computed(() => currentSite.value === 'any');

const {
  data: adminsData,
  isLoading: isAdminsLoading,
  isFetching: isAdminsFetching,
  isRefetching: isAdminsRefetching,
  refetch: adminsRefetch,
} = useAdminsBySiteQuery();

const isPageLoading = computed(() => {
  if (!permissionsLoaded.value) return true;
  return currentSite.value && isAdminsLoading.value;
});

const currentUserId = computed(() => authStore.getUid());

const tableData = computed<AdministratorTableRow[]>(() => {
  const admins = (adminsData?.value as AdministratorRecord[] | undefined) ?? [];

  return admins
    .map((admin) => {
      const baseName = formatAdministratorName(admin) || '--';
      const targetRole = admin.roles?.find((r) => r.siteId === currentSite.value)?.role as AdminSubResource;
      const isCurrentUser = admin.id === currentUserId.value
      const fullName = isCurrentUser ? `${baseName} (You)` : baseName;

      const actions: AdministratorAction[] = [];

      if (!isCurrentUser && !isAllSitesSelected.value && targetRole && can('admins', 'update', targetRole)) {
        actions.push({
          name: 'edit',
          tooltip: 'Edit',
          icon: 'pi pi-pen-to-square',
          callback: () => onClickEditBtn(admin),
        });
      }

      if (!isCurrentUser && !isAllSitesSelected.value && targetRole && can('admins', 'delete', targetRole)) {
        actions.push({
          name: 'remove',
          tooltip: 'Remove',
          icon: 'pi pi-trash',
          callback: () => onClickRemoveBtn(admin),
        });
      }
      
      return {
        ...admin,
        fullName,
        actions,
        isCurrentUser,
      };
    })
    .sort((a, b) => {
      const aCreatedAt = new Date((a.createdAt as string | undefined) ?? '').getTime() || 0;
      const bCreatedAt = new Date((b.createdAt as string | undefined) ?? '').getTime() || 0;
      return bCreatedAt - aCreatedAt;
    });
});

const tableColumns = computed(() => {
  const hasActions = tableData.value.some((row) => row.actions && row.actions.length > 0);

  const columns: { field: string; header: string; dataType: string; sort?: boolean }[] = [
    {
      field: 'fullName',
      header: 'Name',
      dataType: 'string',
    },
    {
      field: 'email',
      header: 'Email',
      dataType: 'string',
    },
    {
      field: 'roles',
      header: 'Role',
      dataType: 'string',
    },
  ];

  if (hasActions) {
    columns.push({
      field: 'actions',
      header: 'Actions',
      dataType: 'string',
      sort: false,
    });
  }

  return columns;
});


const closeAdministratorModal = () => {
  administrator.value = null;
  isAdministratorModalVisible.value = false;
};

const removalTargetLabel = computed(() => {
  if (!administrator.value) {
    return '';
  }

  return formatAdministratorName(administrator.value);
});

const isRemovalConfirmationValid = computed(() => {
  if (!removalTargetLabel.value) {
    return false;
  }

  return (
    removalTargetLabel.value.trim().toLowerCase() === removalConfirmationInput.value.trim().toLowerCase()
  );
});

const openRemovalVerificationModal = () => {
  removalConfirmationInput.value = '';
  isRemovalVerificationModalVisible.value = true;
};

const closeRemovalVerificationModal = () => {
  removalConfirmationInput.value = '';
  isRemovalVerificationModalVisible.value = false;
  administrator.value = null;
};

const onClickRemoveBtn = (admin: AdministratorRecord) => {
  administrator.value = admin;

  confirm.require({
    message: 'You are about to remove this administrator from the site. Are you sure you want to do this?',
    header: 'Remove Administrator from Site',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'No',
    acceptLabel: 'Yes',
    accept: async () => {
      openRemovalVerificationModal();
    },
    reject: () => {
      administrator.value = null;
    },
  });
};

const onClickEditBtn = (admin: AdministratorRecord) => {
  administrator.value = admin;
  isAdministratorModalVisible.value = true;
};

async function executeAdministratorRemoval() {
  if (!administrator.value || !isRemovalConfirmationValid.value || isRemovingAdministrator.value) {
    return;
  }

  const siteId = currentSite.value;

  if (!siteId) {
    toast.add({
      severity: 'warn',
      summary: 'Missing Site',
      detail: 'Select a site before removing an administrator.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    administrator.value = null;
    closeRemovalVerificationModal();
    return;
  }

  isRemovingAdministrator.value = true;

  try {
    await roarfirekit
      .value!.removeAdministratorFromSite(administrator.value.id, siteId);

    adminsRefetch();

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Administrator account removed successfully',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error removing administrator';

    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: errorMessage,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });

    console.error('Error removing administrator from site', error);
  } finally {
    administrator.value = null;
    closeRemovalVerificationModal();
    isRemovingAdministrator.value = false;
  }
}

function formatAdministratorName(admin?: AdministratorRecord | null) {
  if (!admin?.name) {
    return '';
  }

  return [admin.name.first, admin.name.middle, admin.name.last].filter(Boolean).join(' ').trim();
}

function getRowClass(data: AdministratorTableRow) {
  return data.isCurrentUser ? 'current-user-row' : '';
}
</script>
