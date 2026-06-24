import { ref } from 'vue';
import { StatusCodes } from 'http-status-codes';
import { useAuthStore } from '@/store/auth';
import { getRoarApiClient } from '@/clients/roar-api';
import useCreateFamilyMutation from '@/composables/mutations/useCreateFamilyMutation';
import { mapParentFormToCreateFamily } from '@/helpers/registration/mapParentFormToCreateFamily';
import { resolveConsentAgreementVersionId } from '@/helpers/registration/resolveConsentAgreementVersionId';

/**
 * Orchestrates the ROAR@Home parent/guardian registration saga against the
 * typed API, replacing the legacy one-shot firekit `createNewFamily` call used
 * by `pages/RegisterFamilyUsers.vue`.
 *
 * The old call atomically created the caretaker's Firebase account, the family,
 * and recorded consent. The new flow is a multi-step saga:
 *
 *   1. Resolve the current consent agreement version (FAIL HARD if unavailable —
 *      consent must never be silently skipped). Done first so the most
 *      compliance-sensitive failure aborts BEFORE any account is created.
 *   2. `POST /v1/families/` — create the caretaker + family (public, no token).
 *   3. Sign in the new caretaker (stays on firekit per the auth-unit migration
 *      boundary) and force a fresh ID token so the next calls are authenticated.
 *   4. `GET /me` — obtain the caretaker's user id (not returned by step 2).
 *   5. `POST /v1/users/:id/agreements` — record the caretaker's consent.
 *
 * Sign-in (`logInWithEmailAndPassword`) and availability pre-checks intentionally
 * remain on firekit and are out of scope for this migration.
 *
 * Partial-failure / re-entry: once the family exists, re-`POST /families/` returns
 * 422 ("one family per caretaker"). When that happens we treat it as a resumed
 * attempt — sign in with the submitted credentials and resume at consent — which
 * recovers the common case (a prior attempt that died after create but before
 * consent) without needing the familyId (consent is recorded against the
 * caretaker's `/me` id, not the family). If sign-in then fails, we surface a
 * clear, recoverable error rather than guessing.
 *
 * @returns {{ submit: (form: Object) => Promise<void>, isSubmitting: import('vue').Ref<boolean>, error: import('vue').Ref<Error|null> }}
 */
export function useFamilyRegistration() {
  const authStore = useAuthStore();
  const createFamilyMutation = useCreateFamilyMutation();

  const isSubmitting = ref(false);
  const error = ref(null);

  /**
   * Signs in the caretaker and records their consent. Shared by the happy path
   * and the 422 resume path.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} agreementVersionId
   */
  async function signInAndRecordParentConsent(email, password, agreementVersionId) {
    await authStore.logInWithEmailAndPassword({ email, password });

    // Guarantee a fresh ID token synchronously before calling the API; relying
    // on the onIdTokenChanged listener to have populated accessToken would race.
    await authStore.forceIdTokenRefresh();

    const client = getRoarApiClient();

    const meResult = await client.me.get();
    if (meResult.status !== StatusCodes.OK) {
      const meError = new Error(`Failed to load account after sign-in (status ${meResult.status}).`);
      meError.status = meResult.status;
      meError.body = meResult.body;
      throw meError;
    }
    const parentId = meResult.body.data.id;

    const consentResult = await client.users.recordUserAgreement({
      params: { userId: parentId },
      body: { agreementVersionId },
    });

    // 201 = recorded; 409 = already recorded (idempotent — safe on resume).
    if (consentResult.status !== StatusCodes.CREATED && consentResult.status !== StatusCodes.CONFLICT) {
      const consentError = new Error(`Failed to record consent (status ${consentResult.status}).`);
      consentError.status = consentResult.status;
      consentError.body = consentResult.body;
      throw consentError;
    }
  }

  /**
   * Runs the full registration saga for the submitted parent form values.
   *
   * @param {Object} form - Parent form values: `{ email, password, firstName, lastName }`.
   * @returns {Promise<void>} Resolves when registration (incl. consent) completes.
   *   On failure, `error.value` is set and the error is re-thrown so the caller
   *   can keep the user on the form.
   */
  async function submit(form) {
    isSubmitting.value = true;
    error.value = null;

    try {
      const body = mapParentFormToCreateFamily(form);

      // 1. Resolve consent BEFORE creating any account.
      const client = getRoarApiClient();
      const agreementVersionId = await resolveConsentAgreementVersionId(client);

      // 2. Create the caretaker + family.
      try {
        await createFamilyMutation.mutateAsync({ body });
      } catch (createError) {
        if (createError?.status === StatusCodes.CONFLICT) {
          // 409 — email already in use; terminal and user-actionable.
          throw new Error('This email address is already in use. Please sign in instead.');
        }
        if (createError?.status === StatusCodes.UNPROCESSABLE_ENTITY) {
          // 422 — this caretaker already has a family. Treat as a resumed
          // attempt: sign in and resume at consent (no familyId needed).
          try {
            await signInAndRecordParentConsent(body.email, body.password, agreementVersionId);
            return;
          } catch {
            throw new Error(
              'An account already exists for this email. Please sign in to finish setting up your account.',
            );
          }
        }
        throw createError;
      }

      // 3–5. Sign in, fetch /me, record the caretaker's consent.
      await signInAndRecordParentConsent(body.email, body.password, agreementVersionId);
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
