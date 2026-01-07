<template>
  <PvDialog
    :draggable="false"
    :visible="props.isVisible"
    style="width: 100%; max-width: 600px"
    modal
    @update:visible="handleOnClose"
  >
    <template #header>
      <div class="flex flex-column gap-1">
        <h2 class="m-0 font-bold" data-testid="modalTitle">Add New {{ orgTypeLabel }}</h2>
        <p class="m-0 text-gray-500" data-testid="modalDescription">Use the form below to create a new group.</p>
      </div>
    </template>

    <div class="flex flex-column gap-5 m-0 mt-4">
      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvSelect
            v-model="orgType"
            :options="orgTypes"
            class="w-full"
            data-cy="dropdown-org-type"
            input-id="orgType"
            option-label="label"
            show-clear
          />
          <label for="orgType">Group Type<span class="required-asterisk">*</span></label>
        </PvFloatLabel>
        <small v-if="v$.orgType.$error" class="p-error">Please select a type.</small>
      </div>

      <div v-if="parentOrgRequired && orgType?.singular === SINGULAR_ORG_TYPES.CLASSES" class="">
        <div class="flex w-full gap-3">
          <div class="w-full">
            <div class="flex flex-column gap-1 w-full">
              <PvFloatLabel class="w-full">
                <PvSelect
                  v-model="parentSchool"
                  :loading="isFetchingSchools"
                  :options="(schools as SelectedOrg[]) ?? []"
                  class="w-full"
                  data-cy="dropdown-parent-school"
                  input-id="parentSchool"
                  option-label="name"
                  show-clear
                />
                <label for="parentSchool">School<span class="required-asterisk">*</span></label>
              </PvFloatLabel>
              <small v-if="v$.parentSchool.$error" class="p-error">Please select a school.</small>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-column gap-1 w-full">
        <PvFloatLabel>
          <PvInputText id="orgName" v-model="orgName" class="w-full" data-cy="input-org-name" />
          <label for="orgName">{{ orgTypeLabel }} Name<span class="required-asterisk">*</span></label>
        </PvFloatLabel>
        <small v-if="v$.orgName.$error" class="p-error">Please supply a name.</small>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <PvButton
          class="border-none border-round bg-white text-primary p-2 hover:surface-200"
          label="Cancel"
          @click="handleOnClose"
        ></PvButton>
        <PvButton
          :disabled="isSubmitBtnDisabled"
          :label="`Add ${orgTypeLabel}`"
          data-testid="submitBtn"
          @click="submit"
        >
          <div v-if="isSubmitBtnDisabled"><i class="pi pi-spinner pi-spin mr-1"></i> Adding {{ orgTypeLabel }}</div>
        </PvButton>
      </div>
    </template>
  </PvDialog>
</template>

<script setup lang="ts">
import _capitalize from 'lodash/capitalize';
import { computed, ref, toRaw, watch } from 'vue';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { normalizeToLowercase } from '@/helpers';
import { required, requiredIf } from '@vuelidate/validators';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { useToast } from 'primevue/usetoast';
import {
  CreateClassSchema,
  CreateDistrictSchema,
  CreateGroupSchema,
  CreateOrgType,
  CreateSchoolSchema,
} from '@levante-framework/levante-zod';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvSelect from 'primevue/select';
import _useSchoolsQuery from '@/composables/queries/_useSchoolsQuery';
import useOrgNameExistsQuery from '@/composables/queries/useOrgNameExistsQuery';
import useUpsertOrgMutation from '@/composables/mutations/useUpsertOrgMutation';
import useVuelidate from '@vuelidate/core';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthStore } from '@/store/auth';
import { ROLES } from '@/constants/roles';
import { useQueryClient } from '@tanstack/vue-query';
import { DISTRICTS_QUERY_KEY, ORGS_TABLE_QUERY_KEY, SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';

interface OrgType {
  firestoreCollection: string;
  label: string;
  singular: string;
}

interface SelectedOrg {
  id: string;
  name: string;
  tags: string[];
}

interface Props {
  isVisible: boolean;
}

interface Emits {
  (event: 'close'): void;
}

const props = defineProps<Props>();

const emit = defineEmits<Emits>();

const toast = useToast();
const authStore = useAuthStore();
const { hasMinimumRole, userRole } = usePermissions();
const queryClient = useQueryClient();

const isSubmitBtnDisabled = ref(false);
const orgName = ref('');
const orgType = ref<OrgType | undefined>(undefined);

const allOrgTypes: OrgType[] = [
  { firestoreCollection: FIRESTORE_COLLECTIONS.DISTRICTS, singular: SINGULAR_ORG_TYPES.DISTRICTS, label: 'Site' },
  { firestoreCollection: FIRESTORE_COLLECTIONS.SCHOOLS, singular: SINGULAR_ORG_TYPES.SCHOOLS, label: 'School' },
  { firestoreCollection: FIRESTORE_COLLECTIONS.CLASSES, singular: SINGULAR_ORG_TYPES.CLASSES, label: 'Class' },
  { firestoreCollection: FIRESTORE_COLLECTIONS.GROUPS, singular: SINGULAR_ORG_TYPES.GROUPS, label: 'Cohort' },
];

const orgTypes = computed(() => {
  if (!authStore.shouldUsePermissions) {
    return allOrgTypes;
  }

  if (!userRole.value) {
    return [];
  }

  return allOrgTypes.filter((orgType) =>
    orgType.singular === SINGULAR_ORG_TYPES.DISTRICTS
      ? hasMinimumRole(ROLES.SUPER_ADMIN)
      : hasMinimumRole(ROLES.SITE_ADMIN),
  );
});

const isAllSitesSelected = computed(() => authStore.currentSite === 'any');

const parentDistrict = computed<SelectedOrg | undefined>(() => {
  if (!authStore.currentSite || !authStore.currentSiteName || isAllSitesSelected.value) {
    return undefined;
  }
  return {
    id: authStore.currentSite,
    name: authStore.currentSiteName,
    tags: [],
  };
});

const parentSchool = ref<SelectedOrg | undefined>(undefined);
const tags = ref<string[]>([]);

const orgTypesRequiringParent: string[] = [
  SINGULAR_ORG_TYPES.SCHOOLS,
  SINGULAR_ORG_TYPES.CLASSES,
  SINGULAR_ORG_TYPES.GROUPS,
];

const v$ = useVuelidate(
  {
    orgType: {
      required,
    },
    orgName: {
      required,
    },
    parentSchool: {
      required: requiredIf(() => orgType?.value?.singular === SINGULAR_ORG_TYPES.CLASSES),
    },
  },
  {
    orgType,
    orgName,
    parentSchool,
  },
);

const orgTypeLabel = computed(() => (orgType.value ? _capitalize(orgType.value.label) : 'Group'));
const parentOrgRequired = computed(() => orgTypesRequiringParent.includes(orgType.value?.singular || ''));
const selectedSite = computed(() => authStore.currentSite ?? '');

const { mutate: upsertOrg, isPending: isSubmittingOrg } = useUpsertOrgMutation();

const { isFetching: isFetchingSchools, data: schools } = _useSchoolsQuery(selectedSite);

const { isRefetching: isCheckingOrgName, refetch: doesOrgNameExist } = useOrgNameExistsQuery(
  orgName,
  orgType,
  parentDistrict,
  parentSchool,
);

// Watch for changes in loading states, with proper undefined handling
watch(
  () => [isCheckingOrgName?.value ?? false, isSubmittingOrg?.value ?? false],
  ([isChecking, isSubmitting]) => {
    isSubmitBtnDisabled.value = Boolean(isChecking) || Boolean(isSubmitting);
  },
);

const handleOnClose = () => {
  resetForm();
  emit('close');
};

const resetForm = () => {
  orgName.value = '';
  orgType.value = undefined;
  tags.value = [];
  parentSchool.value = undefined;
  v$.value.$reset();
};

const parseCreateOrgData = (data: CreateOrgType) => {
  let formatted;
  let parsed;

  const { districtId, name, normalizedName, parentOrgId, schoolId, tags, type, createdBy, siteId } = data;
  const commonFields = {
    name,
    normalizedName,
    tags,
    type,
    createdBy,
    siteId,
  };

  switch (type) {
    case FIRESTORE_COLLECTIONS.CLASSES:
      formatted = {
        ...commonFields,
        districtId,
        schoolId,
      };

      parsed = CreateClassSchema.safeParse(formatted);

      if (!parsed.success) {
        console.error(parsed.error.message);
        throw new Error(`Invalid data format for ${name}`);
      }

      return parsed.data;

    case FIRESTORE_COLLECTIONS.DISTRICTS:
      formatted = {
        ...commonFields,
        subGroups: [],
      };

      parsed = CreateDistrictSchema.safeParse(formatted);

      if (!parsed.success) {
        console.error(parsed.error.message);
        throw new Error(`Invalid data format for ${name}`);
      }

      return parsed.data;

    case FIRESTORE_COLLECTIONS.GROUPS:
      formatted = {
        ...commonFields,
        parentOrgId,
        parentOrgType: SINGULAR_ORG_TYPES.DISTRICTS,
      };

      parsed = CreateGroupSchema.safeParse(formatted);

      if (!parsed.success) {
        console.error(parsed.error.message);
        throw new Error(`Invalid data format for ${name}`);
      }

      return parsed.data;

    case FIRESTORE_COLLECTIONS.SCHOOLS:
      formatted = {
        ...commonFields,
        districtId,
      };

      parsed = CreateSchoolSchema.safeParse(formatted);

      if (!parsed.success) {
        console.error(parsed.error.message);
        throw new Error(`Invalid data format for ${name}`);
      }

      return parsed.data;

    default:
      throw new Error(`Unknown org type "${type}"`);
  }
};

const submit = async () => {
  isSubmitBtnDisabled.value = true;

  const isFormValid = await v$.value.$validate();

  if (!isFormValid) {
    isSubmitBtnDisabled.value = false;

    return toast.add({
      severity: 'warn',
      summary: 'Validation Error',
      detail: 'Please check the form for errors.',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  const data = {
    name: orgName.value,
    normalizedName: normalizeToLowercase(orgName.value),
    type: orgType.value!.firestoreCollection,
    tags: tags.value?.length > 0 ? tags.value : [],
    schoolId: toRaw(parentSchool.value)?.id,
    districtId: toRaw(parentDistrict.value)?.id,
    parentOrgId: toRaw(parentDistrict.value)?.id,
    createdBy: authStore.getUserId(),
  } as CreateOrgType;

  const { data: orgNameExists } = await doesOrgNameExist();

  if (orgNameExists) {
    const errorTitle = `${orgTypeLabel.value} Creation Error`;
    let errorMessage = `${orgTypeLabel.value} with name ${orgName.value} already exists.`;

    if (orgType.value?.singular === SINGULAR_ORG_TYPES.DISTRICTS) {
      errorMessage += ` ${orgTypeLabel.value} names must be unique.`;
    } else {
      errorMessage += ` ${orgTypeLabel.value} names must be unique within a site.`;
    }

    isSubmitBtnDisabled.value = false;

    return toast.add({
      severity: 'error',
      summary: errorTitle,
      detail: errorMessage,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  let parsedData: unknown;

  try {
    parsedData = parseCreateOrgData({ ...(data as CreateOrgType), siteId: authStore.currentSite! });
  } catch (error) {
    isSubmitBtnDisabled.value = false;

    return toast.add({
      severity: 'error',
      summary: 'Validation Error',
      detail: error,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
  }

  upsertOrg(parsedData as CreateOrgType, {
    onSuccess: () => {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${orgTypeLabel.value} created successfully.`,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      queryClient.invalidateQueries({ queryKey: [ORGS_TABLE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DISTRICTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [SCHOOLS_QUERY_KEY] });

      handleOnClose();
    },
    onError: (error) => {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
        life: TOAST_DEFAULT_LIFE_DURATION,
      });

      console.error(`Error creating ${orgTypeLabel.value}:`, error);
    },
    onSettled: () => {
      isSubmitBtnDisabled.value = false;
    },
  });
};
</script>
