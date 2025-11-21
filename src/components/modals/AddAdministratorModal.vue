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
          <label for="first-name">First name</label>
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
          <label for="last-name">Last name</label>
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
      <div class="flex flex-column gap-5">
        <div v-for="(siteRolePair, index) in siteRolePairs" :key="index" class="flex align-items-center gap-2">
          <div class="w-full">
            <div class="flex flex-column gap-1 w-full">
              <PvFloatLabel>
                <PvSelect
                  :id="`site-${index}`"
                  v-model="siteRolePair.district"
                  :options="getAvailableDistricts(index)"
                  optionLabel="label"
                  optionValue="value"
                  filter
                  class="w-full"
                  :data-cy="`select-site-${index}`"
                />
                <label :for="`site-${index}`">Site</label>
              </PvFloatLabel>
              <small v-if="!siteRolePair.district && v$.$dirty" class="p-error">Site is required.</small>
            </div>
          </div>

          <span class="text-gray-500"><i class="pi pi-arrow-right text-sm"></i></span>

          <div class="w-full">
            <div class="flex flex-column gap-1 w-full">
              <PvFloatLabel>
                <PvSelect
                  :id="`role-${index}`"
                  v-model="siteRolePair.role"
                  :options="roleOptions"
                  optionLabel="label"
                  optionValue="value"
                  filter
                  class="w-full"
                  :data-cy="`select-role-${index}`"
                />
                <label :for="`role-${index}`">Role</label>
              </PvFloatLabel>
              <small v-if="!siteRolePair.role && v$.$dirty" class="p-error">Role is required.</small>
            </div>
          </div>

          <PvButton
            v-if="siteRolePairs.length > 1"
            icon="pi pi-times"
            class="p-button-danger"
            variant="link"
            :data-cy="`remove-site-role-${index}`"
            @click="removeSiteRolePair(index)"
          />
        </div>

        <PvButton
          label="Add Site"
          icon="pi pi-plus"
          class="p-button-outlined p-button-secondary w-full md:w-auto"

          data-cy="add-site-role-button"
          @click="addSiteRolePair"
        />
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
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import { ROLES } from '@/constants/roles';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { useAuthStore } from '@/store/auth';
import { Name } from '@levante-framework/firekit/lib/interfaces';
import { AdminSubResource } from '@levante-framework/permissions-core';
import useVuelidate from '@vuelidate/core';
import { required } from '@vuelidate/validators';
import _cloneDeep from 'lodash/cloneDeep';
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

interface DistrictData {
  id: string;
  name: string;
}

interface DistrictOption {
  value: string;
  label: string;
}

interface SiteRolePair {
  district: string;
  role: string;
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
const { roarfirekit } = storeToRefs(authStore);
const { isUserSuperAdmin } = authStore;
const { can } = usePermissions();
const toast = useToast();

const { data: districtsData } = useDistrictsListQuery();

const districts = computed<DistrictOption[]>(
  () => districtsData?.value?.map((district: DistrictData) => ({ value: district?.id, label: district?.name })) || [],
);


const isEditMode = computed(() => Boolean(props?.data));
const administratorName = computed(() => [props.data?.name?.first, props.data?.name?.middle, props.data?.name?.last].filter(Boolean).join(' ').trim());
const modalTitle = computed(() => (isEditMode.value ? 'Update Administrator Roles' : 'Add Administrator'));
const submitBtnLabel = computed(() => (isEditMode.value ? 'Update Administrator' : 'Add Administrator'));
const submittingBtnLabel = computed(() => (isEditMode.value ? 'Updating Administrator' : 'Adding Administrator'));
const roleOptions = computed(() => {
  const action = isEditMode.value ? 'update' : 'create';

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
const siteRolePairs = ref<SiteRolePair[]>([{ district: '', role: '' }]);
const initialSiteRolePairs = ref<SiteRolePair[]>([]);

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

const validateSiteRolePairs = (): boolean => siteRolePairs.value.every((pair) => pair.district && pair.role);

const hasRoleChanges = computed(() => {
  if (!isEditMode.value) {
    return true;
  }

  const normalizedInitial = normalizeSiteRolePairs(initialSiteRolePairs.value);
  const normalizedCurrent = normalizeSiteRolePairs(siteRolePairs.value);

  if (normalizedInitial.length !== normalizedCurrent.length) {
    return true;
  }

  return normalizedCurrent.some((pair, index) => {
    const initialPair = normalizedInitial[index];

    if (!initialPair) {
      return true;
    }

    return pair.district !== initialPair.district || pair.role !== initialPair.role;
  });
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

      const mappedPairs =
        newData.roles?.map((roleData) => ({
          district: roleData.siteId,
          role: roleData.role,
        })) ?? [];

      if (mappedPairs.length > 0) {
        siteRolePairs.value = mappedPairs;
        initialSiteRolePairs.value = _cloneDeep(mappedPairs);
      } else {
        siteRolePairs.value = [{ district: '', role: '' }];
        initialSiteRolePairs.value = [];
      }
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

function addSiteRolePair() {
  siteRolePairs.value.push({ district: '', role: '' });
}

function handleOnClose() {
  emit('close');
  resetForm();
}

function resetForm() {
  email.value = '';
  firstName.value = '';
  lastName.value = '';
  middleName.value = '';
  siteRolePairs.value = [{ district: '', role: '' }];
  initialSiteRolePairs.value = [];

  isSubmitting.value = false;
}

function removeSiteRolePair(index: number) {
  if (siteRolePairs.value.length > 1) {
    siteRolePairs.value.splice(index, 1);
  }
}

async function submit() {
  if (isSubmitDisabled.value) {
    return;
  }

  const isValid = await v$.value.$validate();

  if (!isValid) {
    return;
  }

  if (!validateSiteRolePairs()) {
    return toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Please select a site and role for all entries.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  isSubmitting.value = true;

  if (email.value.trim().length <= 0) {
    isSubmitting.value = false;

    return toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Email address is required',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  const name: Name = {
    first: firstName.value,
    middle: middleName.value,
    last: lastName.value,
  };

  const roles: { role: string; siteId: string; siteName: string }[] = [];

  siteRolePairs.value.forEach((pair) => {
    const district = districts.value.find((d: DistrictOption) => d.value === pair.district);

    if (district && pair.role) {
      roles.push({
        role: pair.role,
        siteId: district.value,
        siteName: district.label,
      });
    }
  });

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

function getAvailableDistricts(index: number): DistrictOption[] {
  const selectedDistricts = siteRolePairs.value
    .map((pair, pairIndex) => (pairIndex === index ? null : pair.district))
    .filter((districtId): districtId is string => Boolean(districtId));

  return districts.value.filter(
    (district) =>
      siteRolePairs.value[index]?.district === district.value || !selectedDistricts.includes(district.value),
  );
}

function normalizeSiteRolePairs(pairs: SiteRolePair[]): SiteRolePair[] {
  return pairs
    .filter((pair) => pair.district && pair.role)
    .map((pair) => ({ ...pair }))
    .sort((a, b) => a.district.localeCompare(b.district));
}
</script>
