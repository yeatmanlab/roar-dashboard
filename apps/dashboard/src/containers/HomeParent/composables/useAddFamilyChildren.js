import { ref } from 'vue';
import useAddFamilyChildrenMutation from '@/composables/mutations/useAddFamilyChildrenMutation';
import { mapStudentFormToAddChild } from '@/helpers/registration/mapStudentFormToAddChild';

/**
 * Orchestrates adding children to an existing ROAR@Home family against the typed
 * API, replacing the legacy firekit `addStudentsToFamily` one-shot call.
 *
 * The caretaker is already authenticated here, so the saga is simply:
 *
 *   1. `POST /v1/families/:familyId/users` — create the children (atomic).
 *
 * No agreement work is done here. The legacy firekit call recorded a behavioral
 * consent per child at creation; under the migrated design that is wrong. Each
 * child's per-administration consent/assent is handled later, post-auth, by the
 * per-administration consent gate — not at account creation.
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
   * Adds the given students to the family.
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

      // Map every student up front so a bad entry fails before any write.
      const children = students.map((student) => mapStudentFormToAddChild(student));

      // Create the children (atomic on the backend).
      const { ids } = await addChildrenMutation.mutateAsync({ familyId, body: { children } });

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
