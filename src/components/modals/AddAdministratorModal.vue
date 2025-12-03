<template>
  <PvDialog
    modal
    style="width: 100%; max-width: 600px"
    :draggable="false"
    :visible="props.isVisible"
    @update:visible="handleOnClose"
  >
    <template #header>
      <div class="flex flex-column gap-1">
        <h2 class="m-0 font-bold" data-testid="modalTitle">{{ modalTitle }}</h2>
        <p v-if="isEditMode" class="m-0 pt-2 text-md text-gray-600">Updating roles for <span class="font-bold">{{ administratorName }}</span>.</p>
      </div>
    </template>

    <div v-if="!isEditMode" class="flex gap-2 m-0 mt-4">
      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvInputText id="first-name" v-model="firstName" class="w-full" data-cy="input-administrator-first-name" />
          <label for="first-name">First name<span class="required-asterisk">*</span></label>
        </PvFloatLabel>
        <small v-if="v$.firstName.$error" class="p-error">First name is required.</small>
      </div>

      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvInputText id="middle-name" v-model="middleName" class="w-full" data-cy="input-administrator-middle-name" />
          <label for="middle-name">Middle name</label>
        </PvFloatLabel>
      </div>

      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvInputText id="last-name" v-model="lastName" class="w-full" data-cy="input-administrator-last-name" />
          <label for="last-name">Last name<span class="required-asterisk">*</span></label>
        </PvFloatLabel>
        <small v-if="v$.lastName.$error" class="p-error">Last name is required.</small>
      </div>
    </div>

    <div v-if="!isEditMode" class="w-full m-0 mt-5">
      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvInputText id="email" v-model="email" class="w-full" data-cy="input-administrator-email" />
          <label for="email">Email</label>
        </PvFloatLabel>
        <small v-if="v$.email.$error" class="p-error">Email is required.</small>
      </div>
    </div>

    <div class="w-full m-0 mt-5">
      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvSelect
            id="role"
            v-model="selectedRole"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            filter
            class="w-full"
            data-cy="select-role"
          />
          <label for="role">Role<span class="required-asterisk">*</span></label>
        </PvFloatLabel>
        <small v-if="!selectedRole && v$.$dirty" class="p-error">Role is required.</small>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <PvButton class="p-button-secondary p-button-outlined" label="Cancel" @click="handleOnClose"></PvButton>

        <PvButton :disabled="isSubmitDisabled" :label="submitBtnLabel" data-testid="submitBtn" @click="submit">
          <div v-if="isSubmitting"><i class="pi pi-spinner pi-spin mr-1"></i> {{ submittingBtnLabel }}</div>
        </PvButton>
      </div>
    </template>
  </PvDialog>
</template>

<script lang="ts" setup>
import { usePermissions } from '@/composables/usePermissions';
import { ROLES } from '@/constants/roles';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { useAuthStore } from '@/store/auth';
import { Name } from '@levante-framework/firekit/lib/interfaces';
import { AdminSubResource } from '@levante-framework/permissions-core';
import useVuelidate from '@vuelidate/core';
import { required } from '@vuelidate/validators';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvSelect from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';

interface AdministratorData {
  id?: string;
  email?: string;
  name?: {
    first?: string;
    middle?: string;
    last?: string;
  };
  roles?: Array<{
    role: string;
    siteId: string;
    siteName: string;
  }>;
  adminOrgs?: {
    districts?: string[];
    schools?: string[];
    classes?: string[];
    groups?: string[];
    families?: string[];
  };
}

interface Emits {
  (event: 'close'): void;
  (event: 'refetch'): void;
}

interface Props {
  data?: AdministratorData | null;
  isVisible?: boolean;
}

const emit = defineEmits<Emits>();

const props = withDefaults(defineProps<Props>(), {
  data: null,
  isVisible: false,
});

const authStore = useAuthStore();
const { roarfirekit, currentSite, currentSiteName } = storeToRefs(authStore);
const { isUserSuperAdmin } = authStore;
const { can } = usePermissions();
const toast = useToast();


const isEditMode = computed(() => Boolean(props?.data));
const administratorName = computed(() => [props.data?.name?.first, props.data?.name?.middle, props.data?.name?.last].filter(Boolean).join(' ').trim());
const modalTitle = computed(() => (isEditMode.value ? 'Update Administrator Roles' : 'Add Administrator'));
const submitBtnLabel = computed(() => (isEditMode.value ? 'Update Administrator' : 'Add Administrator'));
const submittingBtnLabel = computed(() => (isEditMode.value ? 'Updating Administrator' : 'Adding Administrator'));
const roleOptions = computed(() => {
  // Always use 'create' permission - the question is "can I assign this role to someone?"
  // The edit button visibility already gates who we can edit (based on their current role)
  const action = 'create';

  return Object.values(ROLES)
    .map((role) => {
      switch (role) {
        case ROLES.SUPER_ADMIN:
          return isUserSuperAdmin() ? { value: role, label: 'Super Admin' } : null;
        case ROLES.SITE_ADMIN:
          return can('admins', action, role as AdminSubResource)
            ? { value: role, label: 'Site Admin' }
            : null;
        case ROLES.ADMIN:
          return can('admins', action, role as AdminSubResource)
            ? { value: role, label: 'Admin' }
            : null;
        case ROLES.RESEARCH_ASSISTANT:
          return can('admins', action, role as AdminSubResource)
            ? { value: role, label: 'Research Assistant' }
            : null;
        default:
          return null;
      }
    })
    .filter((option) => option !== null);
});

const email = ref<string>('');
const firstName = ref<string>('');
const isSubmitting = ref(false);
const isTestData = ref(false);
const lastName = ref<string>('');
const middleName = ref<string>('');
const selectedRole = ref<string>('');
const initialRole = ref<string>('');

const v$ = useVuelidate(
  {
    email: { required },
    firstName: { required },
    lastName: { required },
  },
  {
    email,
    firstName,
    lastName,
  },
);

const hasRoleChanges = computed(() => {
  if (!isEditMode.value) {
    return true;
  }
  return selectedRole.value !== initialRole.value;
});

const isSubmitDisabled = computed(() => {

  if (isSubmitting.value) {
    return true;
  }

  if (isEditMode.value && !hasRoleChanges.value) {
    return true;
  }

  return false;
});

watch(
  () => props.data,
  (newData) => {
    if (newData) {
      const newFirstName = newData?.name?.first;
      const newMiddleName = newData?.name?.middle;
      const newLastName = newData?.name?.last;

      email.value = newData.email ?? '';
      firstName.value = newFirstName ?? '';
      lastName.value = newLastName ?? '';
      middleName.value = newMiddleName ?? '';

      const currentSiteRole = newData.roles?.find((roleData) => roleData.siteId === currentSite.value);
      selectedRole.value = currentSiteRole?.role ?? '';
      initialRole.value = currentSiteRole?.role ?? '';
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

function handleOnClose() {
  emit('close');
  resetForm();
}

function resetForm() {
  email.value = '';
  firstName.value = '';
  lastName.value = '';
  middleName.value = '';
  selectedRole.value = '';
  initialRole.value = '';
  isSubmitting.value = false;
}

async function submit() {
  if (isSubmitDisabled.value) {
    return;
  }

  const isValid = await v$.value.$validate();

  if (!isValid && !isEditMode.value) {
    isSubmitting.value = false;

    return toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Missing required fields.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  if (!selectedRole.value) {
    return toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Please select a role.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  isSubmitting.value = true;

  const name: Name = {
    first: firstName.value,
    middle: middleName.value,
    last: lastName.value,
  };

  const roles: { role: string; siteId: string; siteName: string }[] = [
    {
      role: selectedRole.value,
      siteId: currentSite.value!,
      siteName: currentSiteName.value!,
    },
  ];

  // If props.data, we are updating an existing administrator.
  if (props?.data?.id) {
    return await roarfirekit
      .value!.updateAdministrator({ adminUid: props.data.id, email: email.value, name, roles, isTestData: isTestData.value })
      .then(() => {
        isSubmitting.value = false;

        toast.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Administrator account updated successfully',
          life: TOAST_DEFAULT_LIFE_DURATION,
        });

        emit('refetch');

        handleOnClose();
      })
      .catch((error) => {
        isSubmitting.value = false;

        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: error.message,
          life: TOAST_DEFAULT_LIFE_DURATION,
        });

        console.error('Error updating administrator', error);
      });
  }

  return await roarfirekit
    .value!.createNewPermissionsAdmin({ email: email.value, name, roles, isTestData: isTestData.value })
    .then(() => {
      isSubmitting.value = false;

      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Administrator account created successfully',
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      emit('refetch');

      handleOnClose();
    })
    .catch((error) => {
      isSubmitting.value = false;

      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error('Error creating administrator', error);
    });
}
</script>
