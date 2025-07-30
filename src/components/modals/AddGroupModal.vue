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

      <div v-if="parentOrgRequired" class="">
        <div class="flex w-full gap-3">
          <div class="flex flex-column gap-1 w-full">
            <PvFloatLabel class="w-full">
              <PvSelect
                v-model="parentDistrict"
                :loading="isLoadingDistricts"
                :options="districts"
                class="w-full"
                data-cy="dropdown-parent-district"
                input-id="parentDistrict"
                option-label="name"
                show-clear
              />
              <label for="parentDistrict">Site<span class="required-asterisk">*</span></label>
            </PvFloatLabel>
            <small v-if="v$.parentDistrict.$error" class="p-error">Please select a site.</small>
          </div>

          <div v-if="orgType?.singular === 'class'" class="w-full">
            <div class="flex flex-column gap-1 w-full">
              <PvFloatLabel class="w-full">
                <PvSelect
                  v-model="parentSchool"
                  :loading="!schoolDropdownEnabled"
                  :options="schools"
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

      <p class="m-0">Optional fields:</p>

      <PvFloatLabel>
        <PvAutoComplete
          v-model="tags"
          class="w-full"
          data-cy="input-autocomplete"
          dropdown
          multiple
          name="tags"
          :options="allTags"
          :suggestions="tagSuggestions"
          @complete="searchTags"
        />
        <label for="tags">Tags</label>
      </PvFloatLabel>
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
import _union from 'lodash/union';
import _without from 'lodash/without';
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
import PvAutoComplete from 'primevue/autocomplete';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import PvFloatLabel from 'primevue/floatlabel';
import PvInputText from 'primevue/inputtext';
import PvSelect from 'primevue/select';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useGroupsListQuery from '@/composables/queries/useGroupsListQuery';
import useOrgNameExistsQuery from '@/composables/queries/useOrgNameExistsQuery';
import useSchoolClassesQuery from '@/composables/queries/useSchoolClassesQuery';
import useUpsertOrgMutation from '@/composables/mutations/useUpsertOrgMutation';
import useVuelidate from '@vuelidate/core';

interface OrgType {
  firestoreCollection: string;
  label: string;
  singular: string;
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

const isSubmitBtnDisabled = ref(false);
const orgName = ref('');
const orgType = ref<OrgType | undefined>(undefined);
const orgTypes: OrgType[] = [
  { firestoreCollection: 'districts', singular: 'district', label: 'Site' },
  { firestoreCollection: 'schools', singular: 'school', label: 'School' },
  { firestoreCollection: 'classes', singular: 'class', label: 'Class' },
  { firestoreCollection: 'groups', singular: 'group', label: 'Cohort' },
];
const parentDistrict = ref(undefined);
const parentSchool = ref(undefined);
const tags = ref([]);
const tagSuggestions = ref([]);

const v$ = useVuelidate(
  {
    orgType: {
      required,
    },
    orgName: {
      required,
    },
    parentDistrict: {
      required: requiredIf(() => ['school', 'class', 'group'].includes(orgType?.value?.singular || '')),
    },
    parentSchool: {
      required: requiredIf(() => orgType?.value?.singular === 'class'),
    },
  },
  {
    orgType,
    orgName,
    parentDistrict,
    parentSchool,
  },
);

const allTags = computed(() => {
  const districtTags = (districts.value ?? []).map((org: CreateOrgType) => org.tags);
  const schoolTags = (districts.value ?? []).map((org: CreateOrgType) => org.tags);
  const classTags = (classes.value ?? []).map((org: CreateOrgType) => org.tags);
  const groupTags = (groups.value ?? []).map((org: CreateOrgType) => org.tags);
  return _without(_union(...districtTags, ...schoolTags, ...classTags, ...groupTags), undefined) || [];
});
const classQueryEnabled = computed(() => parentSchool?.value !== undefined);
const orgTypeLabel = computed(() => (orgType.value ? _capitalize(orgType.value.label) : 'Group'));
const parentOrgRequired = computed(() => ['school', 'class', 'group'].includes(orgType.value?.singular || ''));
const selectedDistrict = computed(() => parentDistrict?.value?.id);
const selectedSchool = computed(() => parentSchool?.value?.id);
const schoolQueryEnabled = computed(() => parentDistrict?.value !== undefined);
const schoolDropdownEnabled = computed(() => {
  return parentDistrict.value && !isFetchingSchools.value;
});

const { mutate: upsertOrg, isPending: isSubmittingOrg } = useUpsertOrgMutation();

const { data: classes } = useSchoolClassesQuery(selectedSchool, {
  enabled: classQueryEnabled,
});

const { data: districts, loading: isLoadingDistricts } = useDistrictsListQuery();

const { data: groups } = useGroupsListQuery();

const { isFetching: isFetchingSchools, data: schools } = useDistrictSchoolsQuery(selectedDistrict, {
  enabled: schoolQueryEnabled,
});

const { isRefetching: isCheckingOrgName, refetch: doesOrgNameExist } = useOrgNameExistsQuery(
  orgName,
  orgType,
  parentDistrict,
  parentSchool,
);

watch([isCheckingOrgName, isSubmittingOrg], ([isChecking, isSubmitting]) => {
  isSubmitBtnDisabled.value = isChecking || isSubmitting;
});

const handleOnClose = () => {
  resetForm();
  emit('close');
};

const resetForm = () => {
  orgName.value = '';
  orgType.value = undefined;
  tags.value = [];
  parentDistrict.value = undefined;
  parentSchool.value = undefined;
  v$.value.$reset();
};

const searchTags = (e) => {
  const query = e.query.toLowerCase();
  let filteredOptions = allTags.value.filter((opt) => opt.toLowerCase().includes(query));

  if (filteredOptions.length === 0 && query) {
    filteredOptions.push(query);
  } else {
    filteredOptions = filteredOptions.map((opt) => opt);
  }

  tagSuggestions.value = filteredOptions;
};

const parseCreateOrgData = (data: CreateOrgType) => {
  let formatted;
  let parsed;

  const { districtId, name, normalizedName, parentOrgId, schoolId, tags, type } = data;
  const commonFields = {
    name,
    normalizedName,
    tags,
    type,
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
      throw new Error(`Unknown org type: ${type}`);
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

  const data: CreateOrgType = {
    name: orgName.value,
    normalizedName: normalizeToLowercase(orgName.value),
    type: orgType.value!.firestoreCollection,
    tags: tags.value?.length > 0 ? tags.value : [],
    schoolId: toRaw(parentSchool.value)?.id,
    districtId: toRaw(parentDistrict.value)?.id,
    parentOrgId: toRaw(parentDistrict.value)?.id,
  };

  const { data: orgNameExists } = await doesOrgNameExist();

  if (orgNameExists) {
    const errorTitle = `${orgTypeLabel.value} Creation Error`;
    let errorMessage: string;

    if (orgType.value?.singular === SINGULAR_ORG_TYPES.DISTRICTS) {
      errorMessage = `${orgTypeLabel.value} with name ${orgName.value} already exists. ${orgTypeLabel.value} names must be unique.`;
    } else {
      errorMessage = `${orgTypeLabel.value} with name ${orgName.value} already exists. ${orgTypeLabel.value} names must be unique within a site.`;
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
    parsedData = parseCreateOrgData(data);
  } catch (error) {
    return toast.add({
      severity: 'error',
      summary: 'Parse Error',
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
