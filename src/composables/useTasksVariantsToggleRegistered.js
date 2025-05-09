import { ref, watch } from 'vue';
import useToggleRegisteredTasksMutation from '@/composables/mutations/useToggleRegisteredTasksMutation';
import useToggleRegisteredVariantsMutation from '@/composables/mutations/useToggleRegisteredVariantsMutation';

/**
 * Composable for managing registration state of tasks and variants
 *
 * This provides a centralized way to manage the registration status
 * and handle toggling of registered tasks and variants.
 */
export function useTasksVariantsToggleRegistered() {
  const registeredTasksOnly = ref(localStorage.getItem('registeredTasksOnly') === 'false' ? false : true);
  const registeredVariantsOnly = ref(localStorage.getItem('registeredVariantsOnly') === 'false' ? false : true);

  watch(registeredTasksOnly, (value) => {
    localStorage.setItem('registeredTasksOnly', value);
  });

  watch(registeredVariantsOnly, (value) => {
    localStorage.setItem('registeredVariantsOnly', value);
  });

  const { mutate: toggleRegisteredTasks } = useToggleRegisteredTasksMutation();
  const { mutate: toggleRegisteredVariants } = useToggleRegisteredVariantsMutation();

  const updateRegisteredTasksOnly = (value) => {
    registeredTasksOnly.value = value;
    toggleRegisteredTasks(value, null);
  };

  const updateRegisteredVariantsOnly = (value) => {
    registeredVariantsOnly.value = value;
    toggleRegisteredVariants(value);
  };

  return {
    registeredTasksOnly,
    registeredVariantsOnly,
    updateRegisteredTasksOnly,
    updateRegisteredVariantsOnly,
  };
}
