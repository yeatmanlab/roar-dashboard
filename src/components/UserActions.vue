<template>
  <div>
    <div v-if="props.isBasicView">
      <div class="flex gap-2 align-items-center justify-content-center">
        <PvButton data-cy="button-sign-out" @click="() => signOut()">
          <i class="pi pi-sign-out"></i> {{ $t('navBar.signOut') }}
        </PvButton>
      </div>
    </div>
    <div v-else class="flex gap-2 options-wrapper">
      <div v-if="shouldUsePermissions" class="flex align-items-center gap-2">
        <label for="site-select">Site:</label>
        <PvSelect
          :options="siteOptions"
          :modelValue="currentSite"
          :optionValue="(o) => o.value"
          :optionLabel="(o) => o.label"
          class="options-site"
          @change="handleSiteChange"
        >
          <template #value>
            <span>{{ currentSiteName || 'Select a site' }}</span>
          </template>
        </PvSelect>
      </div>

      <!-- Help dropdown -->
      <PvSelect
        :options="helpOptions"
        :optionValue="(o) => o.value"
        :optionLabel="(o) => o.label"
        class="options-help"
        @change="handleHelpChange"
      >
        <template #value>
          <i class="pi pi-question-circle"></i>
        </template>
      </PvSelect>
      <button ref="feedbackButton" style="display: none">Give me feedback</button>

      <!-- Profile dropdown -->
      <PvSelect
        :options="profileOptions"
        :optionValue="(o) => o.value"
        :optionLabel="(o) => o.label"
        class="options-settings"
        @change="handleProfileChange"
      >
        <template #value>
          <i class="pi pi-user"></i>
        </template>
      </PvSelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { APP_ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/auth';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';

interface Props {
  isBasicView: boolean;
}

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownChangeEvent {
  value: string;
}

interface SiteOption {
  siteId: string;
  siteName: string;
}

const authStore = useAuthStore();
const { shouldUsePermissions, currentSite, currentSiteName } = storeToRefs(authStore);
const i18n = useI18n();
const router = useRouter();
const { mutate: signOut } = useSignOutMutation();
const feedbackButton = ref<HTMLButtonElement | null>(null);

const props = defineProps<Props>();

const { data: districtsData = [], isLoading: isLoadingDistricts } = useDistrictsListQuery();

const siteOptions = computed<DropdownOption[]>(() => {
  if (authStore.isUserSuperAdmin()) {
    if (isLoadingDistricts.value || !districtsData?.value) {
      if (currentSite.value && currentSiteName.value) {
        return [{ label: currentSiteName.value, value: currentSite.value }];
      }
      return [];
    }
    const formattedSites = districtsData.value.map((district: { name: string; id: string }) => ({ 
      label: district?.name, 
      value: district?.id 
    }));
    return [{ label: 'All Sites', value: 'any' }, ...formattedSites];
  }
  return authStore.sites.map((site: SiteOption) => ({
    label: site.siteName, 
    value: site.siteId,
  }));
});

const handleSiteChange = (e: DropdownChangeEvent): void => {
  const selectedOption = siteOptions.value.find((opt) => opt.value === e.value);
  authStore.setCurrentSite(e.value, selectedOption?.label ?? null);
};

const helpOptions: DropdownOption[] = [
  { label: 'Researcher Documentation', value: 'researcherDocumentation' },
  { label: 'Report an Issue', value: 'reportAnIssue' },
];

const profileOptions: DropdownOption[] = [
  { label: 'Settings', value: 'settings' },
  { label: i18n.t('navBar.signOut'), value: 'signout' },
];

const handleHelpChange = (e: DropdownChangeEvent): void => {
  if (e.value === 'researcherDocumentation') {
    window.open('https://researcher.levante-network.org/', '_blank');
  } else if (e.value === 'reportAnIssue') {
    window.open('https://levante-support.freshdesk.com', '_blank');
  }
};

const handleProfileChange = (e: DropdownChangeEvent): void => {
  if (e.value === 'settings') {
    router.push({ path: APP_ROUTES.ACCOUNT_PROFILE });
  } else if (e.value === 'signout') {
    signOut();
  }
};
</script>

<style lang="scss">
.options-wrapper {
  @media (max-width: 768px) {
    .p-select-dropdown {
      display: none;
    }
  }
}

.nav-user-wrapper {
  display: flex;
  align-items: center;
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.3rem;
  padding: 0.5rem 0.8rem;
}

.options-site {
  max-width: 300px;
}
</style>
