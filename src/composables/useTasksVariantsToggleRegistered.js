import { ref } from 'vue';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useTaskVariantsQuery from '@/composables/queries/useTaskVariantsQuery';

/**
 * Composable for managing registration state of tasks and variants
 *
 * This provides a centralized way to manage the registration status
 * and handle toggling of registered tasks and variants.
 */
export function useTasksVariantsToggleRegistered() {
  const registeredTasksOnly = ref(localStorage.getItem('registeredTasksOnly') === 'false' ? false : true);
  const registeredVariantsOnly = ref(localStorage.getItem('registeredVariantsOnly') === 'false' ? false : true);

  const { refetch: toggleRegisteredTasks } = useTasksQuery(registeredTasksOnly.value);
  const { refetch: toggleRegisteredVariants } = useTaskVariantsQuery(registeredVariantsOnly.value);

  const updateRegisteredTasksOnly = (value) => {
    registeredTasksOnly.value = value;
    toggleRegisteredTasks();
  };

  const updateRegisteredVariantsOnly = (value) => {
    registeredVariantsOnly.value = value;
    toggleRegisteredVariants();
  };

  return {
    registeredTasksOnly,
    registeredVariantsOnly,
    updateRegisteredTasksOnly,
    updateRegisteredVariantsOnly,
  };
}
