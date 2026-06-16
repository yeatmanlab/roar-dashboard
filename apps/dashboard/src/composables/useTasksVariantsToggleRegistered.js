import { ref, watch } from 'vue';
import useTaskVariantsQuery from '@/composables/queries/useTaskVariantsQuery';

/**
 * Composable for managing registration state of task variants
 *
 * This provides a centralized way to manage the registration status
 * and handle toggling of registered variants.
 *
 * @NOTE The task-level half of this composable (`registeredTasksOnly`) is gone —
 * the "registered" concept is retired at the task level now that tasks are
 * fetched from the backend API. The variant-level toggle remains on its legacy
 * Firestore path until the variant reads migrate to the per-task backend
 * endpoint with a status filter (`draft | published | deprecated`).
 */
export function useTasksVariantsToggleRegistered() {
  // Cleanup: the task-level toggle is retired, so drop the stale persisted key.
  // TODO(1881): remove once the migration has been live for a while.
  localStorage.removeItem('registeredTasksOnly');

  const registeredVariantsOnly = ref(localStorage.getItem('registeredVariantsOnly') === 'false' ? false : true);

  watch(registeredVariantsOnly, (value) => {
    localStorage.setItem('registeredVariantsOnly', value);
  });

  const { refetch: toggleRegisteredVariants } = useTaskVariantsQuery(registeredVariantsOnly.value);

  const updateRegisteredVariantsOnly = (value) => {
    registeredVariantsOnly.value = value;
    toggleRegisteredVariants();
  };

  return {
    registeredVariantsOnly,
    updateRegisteredVariantsOnly,
  };
}
