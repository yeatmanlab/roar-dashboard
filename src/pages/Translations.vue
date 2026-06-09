<template>
  <div class="translations">
    <header class="translations__header">
      <router-link :to="{ path: APP_ROUTES.HOME }">
        <img src="/LEVANTE/Levante_Logo.png" alt="Levante" class="logo" />
      </router-link>
    </header>

    <main class="translations__main">
      <div class="main__options">
        <div class="main__option">
          <small class="main__option__label">Language</small>
          <LanguageSelector size="default" />
        </div>

        <div class="main__option">
          <small class="main__option__label">Task</small>
          <PvSelect
            v-model="selectedBucketTask"
            class="w-full"
            option-label="label"
            option-value="value"
            placeholder="Select Task"
            show-clear
            :options="bucketTaskListData ?? []"
            @change="onChangeSelectedBucketTask"
          />
        </div>
      </div>

      <div v-if="isErrorBucketTaskList || isErrorBucketTaskTranslations" class="error-messages">
        <PvMessage v-if="bucketTaskListError" severity="error" closable>
          {{ bucketTaskListError.message }}
        </PvMessage>
        <PvMessage v-if="bucketTaskTranslationsError" severity="error" closable>
          {{ bucketTaskTranslationsError.message }}
        </PvMessage>
      </div>

      <div v-else class="table-wrapper">
        <PvDataTable
          ref="dt"
          :export-filename="`translations_${selectedBucketTask}_${selectedLocale.toLocaleLowerCase()}`"
          :loading="isLoadingBucketTaskTranslations"
          :value="translationsWithAudio ?? []"
        >
          <template v-if="selectedBucketTask" #header>
            <div class="flex justify-content-between align-items-center mb-4">
              <h3 class="m-0 font-semibold">
                Translations for {{ TASK_DISPLAY_NAMES[selectedBucketTask] }} ({{ localeLanguage }})
              </h3>

              <PvButton icon="pi pi-external-link" label="Export CSV" size="small" @click="() => dt.exportCSV()" />
            </div>
          </template>

          <template v-if="selectedBucketTask" #footer>
            <div class="flex justify-content-between align-items-center mt-4">
              <small>Total entries: {{ translationsWithAudio?.length || '--' }}</small>
              <PvButton icon="pi pi-external-link" label="Export CSV" size="small" @click="() => dt.exportCSV()" />
            </div>
          </template>

          <template v-else #empty>
            <p class="m-0 text-center text-color-secondary">Select a language and a task to view translations</p>
          </template>

          <Column field="audio" header="Audio" :exportable="false">
            <template #body="slotProps">
              <PvButton
                v-if="!slotProps.data.audio?.url"
                v-tooltip.right="getTooltip('Audio not found')"
                :icon="isLoadingBucketAudioList ? 'pi pi-hourglass' : 'pi pi-exclamation-triangle'"
                :severity="isLoadingBucketAudioList ? 'secondary' : 'warn'"
                variant="text"
              />
              <PvButton
                v-else
                :icon="currentAudioUrl === slotProps.data.audio?.url && isAudioPlaying ? 'pi pi-pause' : 'pi pi-play'"
                severity="secondary"
                variant="text"
                @click="toggleAudio(slotProps.data.audio.url)"
              />
            </template>
          </Column>

          <Column field="audioKey" header="Audio Key">
            <template #body="slotProps">
              <code class="text-sm">{{ slotProps.data.audioKey }}</code>
            </template>
          </Column>

          <Column
            v-if="selectedLocale.toLowerCase() !== 'en-us'"
            field="englishSourceString"
            header="English Source String"
          >
            <template #body="slotProps">
              <span class="text-sm text-color-secondary">{{ slotProps.data.englishSourceString }}</span>
            </template>
          </Column>

          <Column field="translationText" header="Translation Text">
            <template #body="slotProps">
              <span class="text-sm">{{ slotProps.data.translationText }}</span>
            </template>
          </Column>
        </PvDataTable>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import LanguageSelector from '@/components/LanguageSelector.vue';
import { useBucketAudioListQuery } from '@/composables/queries/useBucketAudioListQuery';
import { TASK_DISPLAY_NAMES, useBucketTaskListQuery } from '@/composables/queries/useBucketTaskListQuery';
import { useBucketTaskTranslationsQuery } from '@/composables/queries/useBucketTaskTranslationsQuery';
import { APP_ROUTES } from '@/constants/routes';
import { getTooltip } from '@/helpers';
import { findBestMatchingLocale, languageOptions } from '@/translations/i18n';
import PvButton from 'primevue/button';
import Column from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvMessage from 'primevue/message';
import PvSelect from 'primevue/select';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const { locale } = useI18n();
const route = useRoute();
const router = useRouter();

const dt = ref();
const currentAudio = ref<HTMLAudioElement | null>(null);
const currentAudioUrl = ref<string | null>(null);
const isAudioPlaying = ref(false);
const localeLanguage = computed(
  () => (languageOptions[locale.value]?.languageTaskPicker as string) || 'English (North America)',
);
const selectedBucketTask = ref(route.params.taskId as string);
const selectedLocale = computed(() => findBestMatchingLocale(locale.value));

const {
  data: bucketTaskListData,
  error: bucketTaskListError,
  isError: isErrorBucketTaskList,
} = useBucketTaskListQuery();

const {
  data: bucketTaskTranslationsData,
  error: bucketTaskTranslationsError,
  isLoading: isLoadingBucketTaskTranslations,
  isError: isErrorBucketTaskTranslations,
} = useBucketTaskTranslationsQuery(selectedBucketTask, selectedLocale);

const { data: bucketAudioListData, isLoading: isLoadingBucketAudioList } = useBucketAudioListQuery(selectedLocale);

const bucketAudioByKey = computed(
  () => new Map((bucketAudioListData.value ?? []).map((audioFile) => [audioFile.audioKey, audioFile])),
);

const translationsWithAudio = computed(() =>
  (bucketTaskTranslationsData.value ?? []).map((translation) => ({
    ...translation,
    audio: bucketAudioByKey.value.get(translation.audioKey) ?? null,
  })),
);

function onChangeSelectedBucketTask({ value }: { value: string }) {
  router.push({
    name: 'Translations',
    params: {
      taskId: value,
    },
  });
}

function toggleAudio(url?: string) {
  if (!url) return;

  if (currentAudio.value && currentAudioUrl.value === url) {
    if (isAudioPlaying.value) {
      currentAudio.value.pause();
      isAudioPlaying.value = false;
      return;
    }

    currentAudio.value.play();
    isAudioPlaying.value = true;
    return;
  }

  currentAudio.value?.pause();
  const audio = new window.Audio(url);
  currentAudio.value = audio;
  currentAudioUrl.value = url;
  isAudioPlaying.value = true;

  audio.addEventListener('ended', () => {
    isAudioPlaying.value = false;
    currentAudioUrl.value = null;
  });

  audio.play();
}
</script>

<style lang="scss">
.translations {
  display: block;
  width: 100%;
  height: auto;
}

.translations__header {
  display: flex;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 1rem 2rem;
  background-color: white;
  border-top: 6px solid var(--primary-color);
  border-bottom: 1px solid var(--surface-d);
  position: sticky;
  top: 0;
  left: 0;
  z-index: 10;
}

.logo {
  display: block;
  width: 100%;
  max-width: 200px;
  height: auto;
  margin: 0;
}

.translations__main {
  display: block;
  width: 100%;
  max-width: 1200px;
  height: auto;
  margin: 2rem auto;
  padding: 0 2rem;
}

.main__options {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 1rem;
  width: 100%;
  height: auto;
}

.main__option {
  display: block;
  width: 100%;
  max-width: 250px;
  height: auto;
}

.main__option__label {
  display: block;
  margin: 0 0 4px;
  font-weight: 700;
  font-size: 12px;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.error-messages {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  width: 100%;
  height: auto;
  margin: 2rem 0 0;
}

.table-wrapper {
  display: block;
  width: 100%;
  height: auto;
  margin: 2rem 0 0;
  padding: 1rem;
  border: 1px solid var(--surface-d);
  border-radius: 0.5rem;
  overflow: hidden;

  .p-datatable-header,
  .p-datatable-footer {
    border: none;
  }

  .p-datatable-table-container {
    padding: 0 1rem;
  }

  tr:last-child {
    td {
      border: none;
    }
  }
}
</style>
