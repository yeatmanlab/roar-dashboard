<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex flex-column">
        <div class="flex flex-column mb-5 gap-2">
          <div class="flex align-items-center flex-wrap gap-3 mb-2">
            <i class="pi pi-user-plus text-gray-400 rounded" style="font-size: 1.6rem" />
            <div class="admin-page-header">Create a new administrator account</div>
          </div>
          <div class="text-md text-gray-500 ml-6">
            Use this form to create a new user and assign them a role on the selected organizations.
          </div>
        </div>

        <div v-if="!isSubmitting" class="w-full">
          <div class="grid">
            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText
                  id="first-name"
                  v-model="state.firstName"
                  class="w-full"
                  data-cy="input-administrator-first-name"
                />
                <label for="first-name">First Name</label>
              </PvFloatLabel>
              <small
                v-if="v$.firstName.$invalid && submitted"
                class="p-error block mt-1"
                data-cy="error-administrator-first-name"
                >{{ v$.firstName.$errors[0]?.$message }}</small
              >
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText
                  id="middle-name"
                  v-model="state.middleName"
                  class="w-full"
                  data-cy="input-administrator-middle-name"
                />
                <label for="middle-name">Middle Name</label>
              </PvFloatLabel>
              <small
                v-if="v$.middleName.$invalid && submitted"
                class="p-error block mt-1"
                data-cy="error-administrator-middle-name"
                >{{ v$.middleName.$errors[0]?.$message }}</small
              >
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText
                  id="last-name"
                  v-model="state.lastName"
                  class="w-full"
                  data-cy="input-administrator-last-name"
                />
                <label for="last-name">Last Name</label>
              </PvFloatLabel>
              <small
                v-if="v$.lastName.$invalid && submitted"
                class="p-error block mt-1"
                data-cy="error-administrator-last-name"
                >{{ v$.lastName.$errors[0]?.$message }}</small
              >
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvInputText id="email" v-model="state.email" class="w-full" data-cy="input-administrator-email" />
                <label for="email">Email</label>
              </PvFloatLabel>
              <small
                v-if="v$.email.$invalid && submitted"
                class="p-error block mt-1"
                data-cy="error-administrator-email"
                >{{ v$.email.$errors[0]?.$message }}</small
              >
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvPassword
                  id="password"
                  v-model="state.password"
                  class="w-full"
                  input-class="w-full"
                  :feedback="false"
                  toggle-mask
                  data-cy="input-administrator-password"
                />
                <label for="password">Password</label>
              </PvFloatLabel>
              <small
                v-if="v$.password.$invalid && submitted"
                class="p-error block mt-1"
                data-cy="error-administrator-password"
                >{{ v$.password.$errors[0]?.$message }}</small
              >
            </div>

            <div class="col-12 md:col-6 lg:col-3 my-3">
              <PvFloatLabel>
                <PvSelect
                  id="role"
                  v-model="state.role"
                  input-id="role"
                  :options="roleOptions"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                  data-cy="dropdown-administrator-role"
                />
                <label for="role">Role</label>
              </PvFloatLabel>
              <small
                v-if="v$.role.$invalid && submitted"
                class="p-error block mt-1"
                data-cy="error-administrator-role"
                >{{ v$.role.$errors[0]?.$message }}</small
              >
            </div>
          </div>

          <OrgPicker @selection="selection($event)" />
          <small
            v-if="v$.orgSelected.$invalid && submitted"
            class="p-error block mt-2"
            data-cy="error-administrator-orgs"
            >Please select at least one organization.</small
          >

          <PvDivider />

          <div class="flex flex-column w-full align-items-center justify-content-center gap-2">
            <PvButton
              v-tooltip="canCreateAdministrator ? false : PERMISSION_TOOLTIP"
              :disabled="!canCreateAdministrator"
              class="bg-primary text-white border-none border-round p-2 h-3rem hover:bg-red-900"
              label="Create Administrator"
              data-cy="button-create-administrator"
              @click="submit"
            />
            <small v-if="!canCreateAdministrator" class="text-gray-500" data-cy="info-administrator-permission">{{
              PERMISSION_TOOLTIP
            }}</small>
          </div>
        </div>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem" />
          <span>Registering new administrator...</span>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useVuelidate } from '@vuelidate/core';
import { required, email as emailValidator, minLength, helpers } from '@vuelidate/validators';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvDivider from 'primevue/divider';
import PvInputText from 'primevue/inputtext';
import PvPassword from 'primevue/password';
import PvSelect from 'primevue/select';
import OrgPicker from '@/components/OrgPicker.vue';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import useCreateUserMutation from '@/composables/mutations/useCreateUserMutation';
import { getAssignableRoleOptions, buildCreateUserPayload } from '@/helpers/createAdministratorForm';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';

// Matches the backend `IDENTIFIER_WITH_SPACES` pattern enforced by
// `CreateUserNameSchema` (packages/api-contract/src/v1/common/regex.ts): must
// start with a letter, then letters, digits, underscores, hyphens, or spaces.
const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_\- ]*$/;
const PASSWORD_MIN_LENGTH = 8;

// The backend FGA permission for creating users (`can_create_users`) is
// platform-admin-only. The dashboard claims do not expose a distinct
// `platform_admin` signal — only `super_admin` and `minimalAdminOrgs` — so the
// in-component gate uses `isSuperAdmin` as the best available client signal.
// A genuine platform-admin who is not a super admin will pass the backend check
// but be blocked here; the graceful 403 handler in `submit` covers the inverse
// (a super admin whose tuple is missing) and any client/server gate drift. The
// route guard (router meta `permission`) is intentionally broader than this
// button gate — the sidebar link is super-admin-only and the backend is
// authoritative, so a non-super-admin who deep-links here just sees a disabled
// button.
const PERMISSION_TOOLTIP = 'You do not have permission to create administrators.';

const router = useRouter();
const toast = useToast();

const { data: userClaims } = useUserClaimsQuery();
const { isSuperAdmin } = useUserType(userClaims);
const canCreateAdministrator = computed(() => isSuperAdmin.value);

// Super admins may additionally assign the platform_admin role; everyone else
// (and the backend, for non-super-admins) is restricted to the base roles.
const roleOptions = computed(() => getAssignableRoleOptions(isSuperAdmin.value));

const { mutateAsync: createUser, isPending: isSubmitting } = useCreateUserMutation();

const submitted = ref(false);

const state = reactive({
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  password: '',
  role: '',
  districts: [],
  schools: [],
  classes: [],
  groups: [],
});

const NAME_PATTERN_MESSAGE = 'Use only letters, numbers, spaces, hyphens, or underscores, starting with a letter.';

// `helpers.regex` does not skip empty values, so it is only applied to required
// fields (first/last). The optional middle name uses a `req`-guarded pattern
// check that passes when blank.
const nameRule = helpers.withMessage(NAME_PATTERN_MESSAGE, helpers.regex(NAME_REGEX));
const optionalNameRule = helpers.withMessage(
  NAME_PATTERN_MESSAGE,
  (value) => !helpers.req(value) || NAME_REGEX.test(value),
);

const rules = {
  firstName: { required, nameRule },
  middleName: { nameRule: optionalNameRule },
  lastName: { required, nameRule },
  email: { required, email: emailValidator },
  password: { required, minLength: minLength(PASSWORD_MIN_LENGTH) },
  role: { required },
  // At least one org of any type must be selected.
  orgSelected: {
    selected: helpers.withMessage(
      'Please select at least one organization.',
      () => state.districts.length + state.schools.length + state.classes.length + state.groups.length >= 1,
    ),
  },
};

const v$ = useVuelidate(rules, state);

const selection = (selected) => {
  state.districts = selected.districts ?? [];
  state.schools = selected.schools ?? [];
  state.classes = selected.classes ?? [];
  state.groups = selected.groups ?? [];
};

const submit = async () => {
  submitted.value = true;

  const isFormValid = await v$.value.$validate();
  if (!isFormValid) {
    return;
  }

  try {
    await createUser(buildCreateUserPayload(state));
    toast.add({
      severity: TOAST_SEVERITIES.SUCCESS,
      summary: 'Success',
      detail: 'Administrator account created',
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    router.push({ name: 'Home' });
  } catch (error) {
    // The backend is the authoritative gate; surface clear messages for the
    // common denials (403 = not permitted, 409 = email already in use) rather
    // than a raw "status N" string.
    let detail;
    if (error?.status === 403) {
      detail = "You don't have permission to create administrators.";
    } else if (error?.status === 409) {
      detail = 'An account with this email already exists.';
    } else {
      detail = error?.message ?? 'Unknown error';
    }
    toast.add({
      severity: TOAST_SEVERITIES.ERROR,
      summary: 'Error',
      detail,
      life: TOAST_DEFAULT_LIFE_DURATION,
    });
    console.error('Error creating administrator:', error);
  }
};
</script>

<style lang="scss">
.loading-container {
  width: 100%;
  text-align: center;
}
</style>
