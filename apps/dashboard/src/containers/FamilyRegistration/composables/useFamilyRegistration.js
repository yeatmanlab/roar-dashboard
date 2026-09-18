import { ref } from 'vue';
import { StatusCodes } from 'http-status-codes';
import useCreateFamilyMutation from '@/composables/mutations/useCreateFamilyMutation';
import { mapParentFormToCreateFamily } from '@/helpers/registration/mapParentFormToCreateFamily';

/**
 * Orchestrates the ROAR@Home parent/guardian registration saga against the
 * typed API, replacing the legacy one-shot firekit `createNewFamily` call used
 * by `pages/RegisterFamilyUsers.vue`.
 *
 * Registration does NO agreement work. The legacy firekit call also recorded a
 * behavioral-consent document at sign-up; under the migrated design that is
 * wrong. Terms-of-service acceptance is handled AFTER login by the existing
 * `/me.unsignedAgreements` gate (which prompts non-student users for any
 * unsigned TOS), and consent/assent are administration-specific and handled
 * post-auth by the per-administration consent gate. So registration is purely:
 *
 *   1. `POST /v1/families/` — create the caretaker + family (public, no token).
 *   2. Return control to SelfRegistration so it can present an explicit success
 *      state and let the owner continue to Sign In.
 *
 * Crucially this removes the pre-sign-in `GET /v1/agreements` lookup (which would
 * 401, since the agreements list route requires auth) and the consent recording.
 *
 * Sign-in remains an explicit owner action after the success screen. Re-entry
 * failures therefore direct an existing owner to Sign In instead of silently
 * authenticating from the registration form.
 *
 * @returns {{ submit: (form: Object) => Promise<void>, isSubmitting: import('vue').Ref<boolean>, error: import('vue').Ref<Error|null> }}
 */
export function useFamilyRegistration() {
  const createFamilyMutation = useCreateFamilyMutation();

  const isSubmitting = ref(false);
  const error = ref(null);

  /**
   * Runs the registration saga for the submitted parent form values.
   *
   * @param {Object} form - Parent form values: `{ email, password, firstName, lastName }`.
   * @returns {Promise<void>} Resolves when the family and caretaker account are
   *   created. On failure, `error.value` is set and the error is re-thrown so the
   *   caller can keep the user on the form.
   */
  async function submit(form) {
    isSubmitting.value = true;
    error.value = null;

    try {
      const body = mapParentFormToCreateFamily(form);

      // 1. Create the caretaker + family.
      try {
        await createFamilyMutation.mutateAsync({ body });
      } catch (createError) {
        if (createError?.status === StatusCodes.CONFLICT) {
          // 409 — email already in use; terminal and user-actionable.
          throw new Error('This email address is already in use. Please sign in instead.');
        }
        if (createError?.status === StatusCodes.UNPROCESSABLE_ENTITY) {
          throw new Error('An account already exists for this email. Please sign in to access your account.');
        }
        throw createError;
      }
    } catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      throw error.value;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { submit, isSubmitting, error };
}

export default useFamilyRegistration;
