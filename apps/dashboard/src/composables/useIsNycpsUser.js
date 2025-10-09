import { computed } from 'vue';

export default function useIsNycpsUser(userData) {
  const isNycpsUser = computed(() => {
    if (!userData?.value) return false;
    return userData.value?.nycps ?? false;
  });

  return {
    isNycpsUser,
  };
}
