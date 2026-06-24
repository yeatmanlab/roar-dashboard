import { ref } from 'vue';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import useAddFamilyChildrenMutation from '@/composables/mutations/useAddFamilyChildrenMutation';
import { mapStudentFormToAddChild } from '@/helpers/registration/mapStudentFormToAddChild';
import { resolveConsentAgreementVersionId } from '@/helpers/registration/resolveConsentAgreementVersionId';

/**
 * Orchestrates adding children to an existing ROAR@Home family against the typed
 * API, replacing the legacy firekit `addStudentsToFamily` one-shot call.
 *
 * The caretaker is already authenticated here, so the saga is:
 *
 *   1. Resolve the current consent agreement version (FAIL HARD if unavailable —
 *      consent must never be silently skipped). Done first so the saga aborts
 *      BEFORE any child account is created.
 *   2. `POST /v1/families/:familyId/users` — create the children (atomic).
 *   3. For EACH returned child id, `POST /v1/users/:childId/agreements` — record
 *      that child's consent. The signed-in caretaker is guardian-authorized to
 *      record consent for their children.
 *
 * NOTE (wiring follow-up): this saga is parameterized by `familyId`, but the
 * current parent dashboard (`pages/HomeParent.vue` / `components/HomeParentStudentView.vue`)
 * still reads the parent's data — including children — from Firestore and does
 * NOT expose a trustworthy backend family UUID. Wiring this saga into that view
 * requires the parent-home Firestore→API migration to land first. See the
 * migration report. Until then `HomeParentStudentView` keeps the firekit path.
 *
 * @returns {{ submit: (args: { familyId: string, students: Array<Object> }) => Promise<{ ids: string[] }>, isSubmitting: import('vue').Ref<boolean>, error: import('vue').Ref<Error|null> }}
 */
export function useAddFamilyChildren() {
  const addChildrenMutation = useAddFamilyChildrenMutation();

  const isSubmitting = ref(false);
  const error = ref(null);

  /**
   * Adds the given students to the family and records each child's consent.
   *
   * @param {Object} args
   * @param {string} args.familyId - The backend family UUID to add children to.
   * @param {Array<Object>} args.students - Registration-form student entries.
   * @returns {Promise<{ ids: string[] }>} The created child ids (request order).
   */
  async function submit({ familyId, students }) {
    isSubmitting.value = true;
    error.value = null;

    try {
      if (!familyId) {
        throw new Error('A family id is required to add children.');
      }
      if (!Array.isArray(students) || students.length === 0) {
        throw new Error('At least one student is required.');
      }

      // 1. Resolve consent BEFORE creating any child account.
      const client = getRoarApiClient();
      const agreementVersionId = await resolveConsentAgreementVersionId(client);

      // Map every student up front so a bad entry fails before any write.
      const children = students.map((student) => mapStudentFormToAddChild(student));

      // 2. Create the children (atomic on the backend).
      const { ids } = await addChildrenMutation.mutateAsync({ familyId, body: { children } });

      // 3. Record each child's consent. Recorded sequentially so a failure
      // points clearly at the offending child; 409 (already recorded) is
      // treated as success to support re-entry.
      for (const childId of ids) {
        const consentResult = await client.users.recordUserAgreement({
          params: { userId: childId },
          body: { agreementVersionId },
        });

        if (consentResult.status !== StatusCodes.CREATED && consentResult.status !== StatusCodes.CONFLICT) {
          const consentError = new Error(`Failed to record consent for a child (status ${consentResult.status}).`);
          consentError.status = consentResult.status;
          consentError.body = consentResult.body;
          consentError.childId = childId;
          throw consentError;
        }
      }

      return { ids };
    } catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      throw error.value;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { submit, isSubmitting, error };
}

export default useAddFamilyChildren;
