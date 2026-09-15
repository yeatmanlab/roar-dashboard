import { ref } from 'vue';
import { StatusCodes } from 'http-status-codes';
import { useAuthStore } from '@/store/auth';
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
 *   2. Sign in the new caretaker (stays on firekit per the auth-unit migration
 *      boundary) and force a fresh ID token so the dashboard loads authenticated.
 *
 * Crucially this removes the pre-sign-in `GET /v1/agreements` lookup (which would
 * 401, since the agreements list route requires auth) and the consent recording.
 *
 * Sign-in (`logInWithEmailAndPassword`) and availability pre-checks intentionally
 * remain on firekit and are out of scope for this migration.
 *
 * Partial-failure / re-entry: once the family exists, re-`POST /families/` returns
 * 422 ("one family per caretaker"). When that happens we treat it as a resumed
 * attempt and simply sign in with the submitted credentials — there is no consent
 * to resume, so a successful sign-in fully recovers the common case (a prior
 * attempt that created the family but never signed the user in). If sign-in then
 * fails, we surface a clear, recoverable error rather than guessing.
 *
 * @returns {{ submit: (form: Object) => Promise<void>, isSubmitting: import('vue').Ref<boolean>, error: import('vue').Ref<Error|null> }}
 */
export function useFamilyRegistration() {
  const authStore = useAuthStore();
  const createFamilyMutation = useCreateFamilyMutation();

  const isSubmitting = ref(false);
  const error = ref(null);

  /**
   * Signs in the caretaker and forces a fresh ID token. Shared by the happy path
   * and the 422 resume path.
   *
   * @param {string} email
   * @param {string} password
   */
  async function signIn(email, password) {
    await authStore.logInWithEmailAndPassword({ email, password });

    // Guarantee a fresh ID token synchronously before the dashboard makes its
    // first authenticated call; relying on the onIdTokenChanged listener to have
    // populated accessToken would race.
    await authStore.forceIdTokenRefresh();
  }

  /**
   * Runs the registration saga for the submitted parent form values.
   *
   * @param {Object} form - Parent form values: `{ email, password, firstName, lastName }`.
   * @returns {Promise<void>} Resolves when the family is created and the caretaker
   *   is signed in. On failure, `error.value` is set and the error is re-thrown so
   *   the caller can keep the user on the form.
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
          // 422 — this caretaker already has a family. Treat as a resumed
          // attempt: just sign in with the submitted credentials.
          try {
            await signIn(body.email, body.password);
            return;
          } catch {
            throw new Error(
              'An account already exists for this email. Please sign in to finish setting up your account.',
            );
          }
        }
        throw createError;
      }

      // 2. Sign in the new caretaker. Post-auth gates handle TOS and consent.
      await signIn(body.email, body.password);
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
