<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column mb-5">
        <div class="flex justify-content-between mb-2">
          <div class="flex align-items-center gap-3">
            <i class="pi pi-sliders-h text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">Create a new organization</div>
          </div>
        </div>
        <div class="text-md text-gray-500 ml-6">Use this form to create a new organization.</div>
      </div>

      <PvDivider />
      <div class="bg-gray-100 rounded p-4">
        <div class="grid column-gap-3 mt-5 rounded">
          <div class="col-12 md:col-6 lg:col-3 xl:col-3">
            <PvFloatLabel>
              <PvSelect
                v-model="orgType"
                input-id="org-type"
                :options="orgTypes"
                show-clear
                option-label="singular"
                class="w-full"
                data-cy="dropdown-org-type"
              />
              <label for="org-type">Select an Org Type<span id="required-asterisk">*</span></label>
            </PvFloatLabel>
          </div>
        </div>

        <div v-if="parentOrgRequired" class="grid mt-4">
          <div class="col-12 md:col-6 lg:col-4">
            <PvFloatLabel>
              <PvSelect
                v-model="state.parentDistrict"
                input-id="parent-district"
                :options="districts"
                show-clear
                option-label="name"
                placeholder="Select a district"
                :loading="isLoadingDistricts"
                class="w-full"
                data-cy="dropdown-parent-district"
              />
              <label for="parent-district">District<span id="required-asterisk">*</span></label>
              <small v-if="v$.parentDistrict.$invalid && submitted" class="p-error"> Please select a district. </small>
            </PvFloatLabel>
          </div>

          <div v-if="orgType.singular === 'class'" class="col-12 md:col-6 lg:col-4">
            <PvFloatLabel>
              <PvSelect
                v-model="state.parentSchool"
                input-id="parent-school"
                :options="schools"
                show-clear
                option-label="name"
                :placeholder="schoolDropdownEnabled ? 'Select a school' : 'Please select a district first'"
                :loading="!schoolDropdownEnabled"
                class="w-full"
                data-cy="dropdown-parent-school"
              />
              <label for="parent-school">School<span id="required-asterisk">*</span></label>
              <small v-if="v$.parentSchool.$invalid && submitted" class="p-error"> Please select a school. </small>
            </PvFloatLabel>
          </div>
        </div>

        <div class="grid mt-3">
          <div class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvInputText id="org-name" v-model="state.orgName" class="w-full" data-cy="input-org-name" />
              <label for="org-name">{{ orgTypeLabel }} Name<span id="required-asterisk">*</span></label>
              <small v-if="v$.orgName.$invalid && submitted" class="p-error">Please supply a name</small>
            </PvFloatLabel>
          </div>

          <div v-if="showAbbreviation" class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvInputText id="org-initial" v-model="state.orgInitials" class="w-full" data-cy="input-org-initials" />
              <label for="org-initial">{{ orgTypeLabel }} Abbreviation<span id="required-asterisk">*</span></label>
              <small v-if="v$.orgInitials.$invalid && submitted" class="p-error">{{
                v$.orgInitials.$errors[0]?.$message
              }}</small>
            </PvFloatLabel>
          </div>

          <div v-if="orgType?.singular === 'class'" class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvSelect
                v-model="state.classType"
                input-id="class-type"
                :options="CLASS_TYPE_OPTIONS"
                option-label="label"
                option-value="value"
                show-clear
                placeholder="Select a class type"
                class="w-full"
                data-cy="dropdown-class-type"
              />
              <label for="class-type">Class Type<span id="required-asterisk">*</span></label>
              <small v-if="v$.classType.$invalid && submitted" class="p-error">Please select a class type</small>
            </PvFloatLabel>
          </div>

          <div v-if="orgType?.singular === 'group'" class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvSelect
                v-model="state.groupType"
                input-id="group-type"
                :options="GROUP_TYPE_OPTIONS"
                option-label="label"
                option-value="value"
                show-clear
                placeholder="Select a group type"
                class="w-full"
                data-cy="dropdown-group-type"
              />
              <label for="group-type">Group Type<span id="required-asterisk">*</span></label>
              <small v-if="v$.groupType.$invalid && submitted" class="p-error">Please select a group type</small>
            </PvFloatLabel>
          </div>

          <div v-if="orgType?.singular === 'class'" class="col-12 md:col-6 lg:col-4 mt-3">
            <PvFloatLabel>
              <PvSelect
                v-model="state.grade"
                input-id="grade"
                :options="GRADE_OPTIONS"
                show-clear
                option-label="label"
                option-value="value"
                placeholder="Select a grade"
                class="w-full"
                data-cy="dropdown-grade"
              />
              <label for="grade">Grade<span id="required-asterisk">*</span></label>
              <small v-if="v$.grade.$invalid && submitted" class="p-error">Please select a grade</small>
            </PvFloatLabel>
          </div>
        </div>

        <div v-if="['district', 'school', 'group'].includes(orgType?.singular)">
          <div class="mt-5 mb-0 pb-0">Optional fields:</div>

          <div class="grid column-gap-3">
            <div v-if="['district', 'school'].includes(orgType?.singular)" class="col-12 md:col-6 lg:col-4 mt-5">
              <PvFloatLabel>
                <PvInputText
                  v-model="state.ncesId"
                  v-tooltip="ncesTooltip"
                  input-id="nces-id"
                  class="w-full"
                  data-cy="input-nces-id"
                />
                <label for="nces-id">NCES ID</label>
              </PvFloatLabel>
            </div>
          </div>
          <div class="grid mt-3">
            <div class="col-12">
              <span> <i class="pi pi-map"></i></span> Search for a {{ orgType.singular }} address:
            </div>
            <div class="col-12 md:col-6 lg:col-6 xl:col-6 p-inputgroup">
              <GMapAutocomplete
                :options="{
                  fields: ['address_components', 'formatted_address', 'place_id', 'url'],
                }"
                class="p-inputtext p-component w-full"
                data-cy="input-address"
                @place_changed="setAddress"
              >
              </GMapAutocomplete>
            </div>
          </div>
          <div v-if="state.address?.formattedAddress" class="grid">
            <div class="col-12 mt-3" data-cy="chip-address">
              {{ orgTypeLabel }} Address:
              <PvChip
                :label="state.address.formattedAddress"
                removable
                data-cy="chip-address"
                @remove="removeAddress"
              />
            </div>
          </div>
        </div>

        <PvDivider />

        <div class="grid">
          <div class="col-12">
            <PvButton
              :label="submitted ? `Creating ${orgTypeLabel}` : `Create ${orgTypeLabel}`"
              v-tooltip="canCreateOrg ? false : PERMISSION_TOOLTIP"
              :disabled="orgTypeLabel === 'Org' || v$.$invalid || submitted || !canCreateOrg"
              :icon="submitted ? 'pi pi-spin pi-spinner' : ''"
              class="bg-primary text-white border-none border-round h-3rem w-3 hover:bg-red-900"
              data-cy="button-create-org"
              @click="submit"
            />
            <small v-if="!canCreateOrg" class="block mt-2 text-gray-500" data-cy="info-org-permission">{{
              PERMISSION_TOOLTIP
            }}</small>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { StatusCodes } from 'http-status-codes';
import _capitalize from 'lodash/capitalize';
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf, helpers, maxLength } from '@vuelidate/validators';
import PvSelect from 'primevue/select';
import PvButton from 'primevue/button';
import PvChip from 'primevue/chip';
import PvDivider from 'primevue/divider';
import PvInputText from 'primevue/inputtext';
import PvFloatLabel from 'primevue/floatlabel';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useCreateOrgMutation from '@/composables/mutations/useCreateOrgMutation';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import { GRADE_OPTIONS, CLASS_TYPE_OPTIONS, GROUP_TYPE_OPTIONS, buildOrgCreateBody } from '@/helpers/createOrgForm';

// Org creation is super-admin-only on the backend (all four create endpoints gate
// on `isSuperAdmin`), so the button is gated on the dashboard's super-admin signal
// to match the create-administrator form. The graceful 403 handler in `submit`
// remains as a safety net for any client/server gate drift.
const { data: userClaims } = useUserClaimsQuery();
const { isSuperAdmin } = useUserType(userClaims);
// `isSuperAdmin` is already a computed ref from `useUserType`; alias it directly.
const canCreateOrg = isSuperAdmin;
const PERMISSION_TOOLTIP = 'You do not have permission to create organizations.';

const toast = useToast();
const { mutateAsync: createOrg } = useCreateOrgMutation();

const state = reactive({
  orgName: '',
  orgInitials: '',
  ncesId: undefined,
  address: undefined,
  parentDistrict: undefined,
  parentSchool: undefined,
  grade: undefined,
  classType: undefined,
  groupType: undefined,
});

// The districts list query self-gates on `authStore.accessToken`, so no firekit
// init / `initialized` ref is needed — it stays disabled until the user is
// authenticated and then fetches automatically.
const { isLoading: isLoadingDistricts, data: districts } = useDistrictsListQuery();

const selectedDistrict = computed(() => state.parentDistrict?.id);

// `useDistrictSchoolsQuery` self-gates on the access token AND on a truthy
// districtId, so it only fires once a district is chosen.
const { isFetching: isFetchingSchools, data: schools } = useDistrictSchoolsQuery(selectedDistrict);

const schoolDropdownEnabled = computed(() => {
  return state.parentDistrict && !isFetchingSchools.value;
});

const rules = {
  orgName: { required },
  orgInitials: {
    required: helpers.withMessage(
      'Please supply an abbreviation.',
      requiredIf(() => orgType.value?.singular !== 'class'),
    ),
    maxLength: maxLength(10),
    // Mirror the backend abbreviation constraint (`^[A-Za-z0-9]+$`) client-side so
    // a bad value is caught before the request rather than surfacing as a 400.
    format: helpers.withMessage(
      'Abbreviation must be letters and digits only (no spaces or symbols).',
      (value) => !helpers.req(value) || /^[A-Za-z0-9]+$/.test(value),
    ),
  },
  parentDistrict: { required: requiredIf(() => ['school', 'class'].includes(orgType.value?.singular)) },
  parentSchool: { required: requiredIf(() => orgType.value?.singular === 'class') },
  // `grades` is optional on the backend (CreateClassRequestSchema), but the form
  // requires it for classes to encourage complete data — a class created without
  // a grade is harder to work with in reporting downstream.
  grade: { required: requiredIf(() => orgType.value?.singular === 'class') },
  classType: { required: requiredIf(() => orgType.value?.singular === 'class') },
  groupType: { required: requiredIf(() => orgType.value?.singular === 'group') },
};

const v$ = useVuelidate(rules, state);
const submitted = ref(false);

// `plural` is the REST resource path segment (districts/schools/classes/groups),
// not a Firestore collection — the create flow targets the ts-rest backend.
const orgTypes = [
  { plural: 'districts', singular: 'district' },
  { plural: 'schools', singular: 'school' },
  { plural: 'classes', singular: 'class' },
  { plural: 'groups', singular: 'group' },
];

const orgType = ref();
const orgTypeLabel = computed(() => {
  if (orgType.value) {
    return _capitalize(orgType.value.singular);
  }
  return 'Org';
});

const parentOrgRequired = computed(() => ['school', 'class'].includes(orgType.value?.singular));

// Classes have no `abbreviation` field in their create schema, so the input is
// hidden for them; every other org type requires it.
const showAbbreviation = computed(() => orgType.value?.singular !== 'class');

const ncesTooltip = computed(() => {
  if (orgType.value?.singular === 'school') {
    return '12 digit NCES school identification number';
  } else if (orgType.value?.singular === 'district') {
    return '7 digit NCES district identification number';
  }
  return '';
});

const setAddress = (place) => {
  state.address = {
    addressComponents: place.address_components || [],
    formattedAddress: place.formatted_address,
    googlePlacesId: place.place_id,
    googleMapsUrl: place.url,
  };
};

const removeAddress = () => {
  state.address = undefined;
};

const submit = async () => {
  submitted.value = true;
  const isFormValid = await v$.value.$validate();
  if (!isFormValid) {
    submitted.value = false;
    return;
  }

  const orgTypePlural = orgType.value.plural;

  try {
    const body = buildOrgCreateBody(orgTypePlural, state);
    await createOrg({ orgType: orgTypePlural, body });
    toast.add({ severity: 'success', summary: 'Success', detail: `${orgTypeLabel.value} created`, life: 3000 });
    resetForm();
  } catch (error) {
    const detail =
      error?.status === StatusCodes.FORBIDDEN
        ? "You don't have permission to create organizations."
        : `Failed to create ${orgTypeLabel.value.toLowerCase()}. Please try again.`;
    toast.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
  } finally {
    submitted.value = false;
  }
};

const resetForm = () => {
  state.orgName = '';
  state.orgInitials = '';
  state.ncesId = undefined;
  state.address = undefined;
  state.parentDistrict = undefined;
  state.parentSchool = undefined;
  state.grade = undefined;
  state.classType = undefined;
  state.groupType = undefined;
};
</script>

<style lang="scss">
.return-button {
  display: block;
  margin: 1rem 1.75rem;
}

.p-checkbox-box.p-highlight {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

#rectangle {
  background: #fcfcfc;
  border-radius: 0.3125rem;
  border-style: solid;
  border-width: 0.0625rem;
  border-color: #e5e5e5;
  margin: 0 1.75rem;
  padding-top: 1.75rem;
  padding-left: 1.875rem;
  text-align: left;
  overflow: hidden;

  hr {
    margin-top: 2rem;
    margin-left: -1.875rem;
  }

  #heading {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    color: #000000;
    font-size: 1.625rem;
    line-height: 2.0425rem;
  }

  #section-heading {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    font-size: 1.125rem;
    line-height: 1.5681rem;
    color: #525252;
  }

  #administration-name {
    height: 100%;
    border-radius: 0.3125rem;
    border-width: 0.0625rem;
    border-color: #e5e5e5;
  }

  #section {
    margin-top: 1.375rem;
  }

  #section-content {
    font-family: 'Source Sans Pro', sans-serif;
    font-weight: 400;
    font-size: 0.875rem;
    line-height: 1.22rem;
    color: #525252;
    margin: 0.625rem 0rem;
  }

  ::placeholder {
    font-family: 'Source Sans Pro', sans-serif;
    color: #c4c4c4;
  }

  .hide {
    display: none;
  }
}

#required-asterisk {
  color: #ff0000;
}
</style>
