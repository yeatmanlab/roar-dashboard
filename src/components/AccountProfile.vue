<template>
  <div class="account-profile">
    <div v-if="!isModal" class="text-3xl mb-4">Account Settings</div>

    <div class="grid">
      <div class="col-12 md:col-6">
        <div class="field">
          <label for="firstName">First Name</label>
          <PvInputText
            id="firstName"
            v-model="userSettings.firstName"
            class="w-full"
            :disabled="userSettingsStore.loading"
          />
        </div>
      </div>

      <div class="col-12 md:col-6">
        <div class="field">
          <label for="lastName">Last Name</label>
          <PvInputText
            id="lastName"
            v-model="userSettings.lastName"
            class="w-full"
            :disabled="userSettingsStore.loading"
          />
        </div>
      </div>

      <div class="col-12">
        <div class="field">
          <label for="email">Email</label>
          <PvInputText id="email" v-model="userSettings.email" class="w-full" :disabled="userSettingsStore.loading" />
        </div>
      </div>

      <div class="col-12">
        <div class="field">
          <label for="language">Preferred Language</label>
          <PvDropdown
            id="language"
            v-model="userSettings.language"
            :options="languageOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            :disabled="userSettingsStore.loading"
          />
        </div>
      </div>

      <div class="col-12">
        <PvButton
          label="Save Changes"
          class="w-full md:w-auto"
          :loading="userSettingsStore.loading"
          @click="saveSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useUserSettingsStore } from '@/stores/userSettings';
import PvInputText from 'primevue/inputtext';
import PvDropdown from 'primevue/dropdown';
import PvButton from 'primevue/button';

const emit = defineEmits(['settings-saved']);

const props = defineProps({
  targetUserId: {
    type: String,
    default: null,
  },
  isModal: {
    type: Boolean,
    default: false,
  },
});

const toast = useToast();
const userSettingsStore = useUserSettingsStore();
const userSettings = ref({
  firstName: '',
  lastName: '',
  email: '',
  language: 'en',
});

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
];

const loadUserSettings = async () => {
  try {
    const settings = await userSettingsStore.fetchUserSettings(props.targetUserId);
    userSettings.value = { ...settings };
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load user settings',
      life: 3000,
    });
  }
};

const saveSettings = async () => {
  try {
    await userSettingsStore.updateUserSettings(props.targetUserId, userSettings.value);
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Settings saved successfully',
      life: 3000,
    });
    emit('settings-saved');
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to save settings',
      life: 3000,
    });
  }
};

onMounted(() => {
  loadUserSettings();
});
</script>

<style scoped>
.account-profile {
  padding: 1rem;
}

.field {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
</style>
