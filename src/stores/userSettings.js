import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserSettingsStore = defineStore('userSettings', () => {
  const settings = ref(null);
  const loading = ref(false);

  const fetchUserSettings = async (userId = 'current') => {
    loading.value = true;
    try {
      console.log('usersettings', userId);
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/users/${userId}/settings`);
      // settings.value = await response.json();

      // Temporary mock data
      settings.value = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        language: 'en',
      };
      return settings.value;
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const updateUserSettings = async (userId = 'current', newSettings) => {
    loading.value = true;
    try {
      console.log('usersettings', userId);
      // TODO: Replace with actual API call
      // await fetch(`/api/users/${userId}/settings`, {
      //   method: 'PUT',
      //   body: JSON.stringify(newSettings)
      // });
      settings.value = { ...newSettings };
      return settings.value;
    } catch (error) {
      console.error('Failed to update user settings:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  return {
    settings,
    loading,
    fetchUserSettings,
    updateUserSettings,
  };
});
