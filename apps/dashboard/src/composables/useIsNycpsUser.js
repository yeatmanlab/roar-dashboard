import { computed } from 'vue';

/**
 * Determine if the user is affiliated with NYCPS.
 *
 * @param {Object} userData - The user data object.
 * @returns {boolean} Whether the user is affiliated with NYCPS.
 */
export default function useIsNycpsUser(userData) {
  const isNycpsUser = computed(() => {
    if (!userData?.value) return false;
    return userData.value?.nycps ?? false;
  });

  return {
    isNycpsUser,
  };
}
