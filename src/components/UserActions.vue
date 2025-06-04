<template>
  <div>
    <div v-if="props.isBasicView" class="nav-user-wrapper flex align-items-center gap-2 bg-gray-100">
      <div class="flex gap-2 align-items-center justify-content-center">
        <PvButton
          text
          data-cy="button-sign-out"
          class="no-underline h-2 p-1 m-0 text-primary border-none border-round h-2rem text-sm hover:bg-red-900 hover:text-white"
          @click="signOut"
        >
          {{ $t('navBar.signOut') }}
        </PvButton>
      </div>
    </div>
    <div v-else class="flex gap-2 options-wrapper">
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
import { ref, watchEffect } from 'vue';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { APP_ROUTES } from '@/constants/routes';

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

const i18n = useI18n();
const router = useRouter();
const { mutate: signOut } = useSignOutMutation() as any;

const feedbackButton = ref<HTMLButtonElement | null>(null);

const props = defineProps<Props>();

watchEffect((): void => {
  const feedbackElement = document.getElementById('sentry-feedback');
  if (feedbackElement) {
    if (!props.isBasicView) {
      feedbackElement.style.setProperty('display', 'none');
    }
  }
});

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
    window.open('https://watery-wrench-dee.notion.site/13c244e26d9b8005adbde4522455edfd', '_blank');
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

<style>
.options-wrapper {
  position: relative;
  top: -18px;

  .options-settings {
    position: absolute;
    right: 0;
  }
  .options-help {
    position: absolute;
    right: 5.4rem;
  }
}
.nav-user-wrapper {
  display: flex;
  align-items: center;
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.3rem;
  padding: 0.5rem 0.8rem;
}
</style>
