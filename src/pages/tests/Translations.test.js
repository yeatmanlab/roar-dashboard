import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import Translations from '../Translations.vue';

const {
  bucketAudioList,
  bucketTaskList,
  bucketTaskListError,
  bucketTaskTranslations,
  bucketTaskTranslationsError,
  isErrorBucketTaskList,
  isErrorBucketTaskTranslations,
  isLoadingBucketAudioList,
  isLoadingBucketTaskTranslations,
  locale,
  mockAudioPause,
  mockAudioPlay,
  mockRouterPush,
  routeParams,
} = vi.hoisted(() => ({
  bucketAudioList: { value: [] },
  bucketTaskList: { value: [] },
  bucketTaskListError: { value: null },
  bucketTaskTranslations: { value: [] },
  bucketTaskTranslationsError: { value: null },
  isErrorBucketTaskList: { value: false },
  isErrorBucketTaskTranslations: { value: false },
  isLoadingBucketAudioList: { value: false },
  isLoadingBucketTaskTranslations: { value: false },
  locale: { value: 'es-CO' },
  mockAudioPause: vi.fn(),
  mockAudioPlay: vi.fn(),
  mockRouterPush: vi.fn(),
  routeParams: { taskId: 'hearts-and-flowers' },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: routeParams,
  }),
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale,
  }),
}));

vi.mock('@/translations/i18n', () => ({
  findBestMatchingLocale: (value) => (value === 'es-CO' ? 'es-CO' : 'en-US'),
  languageOptions: {
    'en-US': {
      languageTaskPicker: 'English (North America)',
    },
    'es-CO': {
      languageTaskPicker: 'Español (Colombia)',
    },
  },
}));

vi.mock('@/constants/routes', () => ({
  APP_ROUTES: {
    HOME: '/home',
  },
}));

vi.mock('@/helpers', () => ({
  getTooltip: (message) => ({
    value: message,
  }),
}));

vi.mock('@/components/LanguageSelector.vue', () => ({
  default: {
    name: 'LanguageSelector',
    props: ['size'],
    template: '<div data-testid="language-selector">Language Selector</div>',
  },
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'PvButton',
    props: ['icon', 'label', 'severity', 'variant'],
    emits: ['click'],
    template:
      '<button :data-testid="label ? `button-${label}` : `icon-button-${icon}`" @click="$emit(\'click\')">{{ label || icon }}</button>',
  },
}));

vi.mock('primevue/column', () => ({
  default: {
    name: 'Column',
    template: '<div data-testid="column"><slot /></div>',
  },
}));

vi.mock('primevue/datatable', () => ({
  default: {
    name: 'PvDataTable',
    props: {
      exportFilename: String,
      loading: Boolean,
      value: {
        type: Array,
        default: () => [],
      },
    },
    methods: {
      exportCSV: vi.fn(),
    },
    template: `
      <div data-testid="translations-table">
        <div data-testid="export-filename">{{ exportFilename }}</div>
        <div data-testid="loading-state">{{ String(loading) }}</div>
        <slot name="header" />
        <template v-if="value.length">
          <div v-for="translation in value" :key="translation.audioKey" data-testid="translation-row">
            <span data-testid="translation-audio-key">{{ translation.audioKey }}</span>
            <span data-testid="translation-text">{{ translation.translationText }}</span>
            <span data-testid="translation-audio-url">{{ translation.audio?.url || '' }}</span>
          </div>
        </template>
        <slot v-else name="empty" />
        <slot name="footer" />
        <slot />
      </div>
    `,
  },
}));

vi.mock('primevue/message', () => ({
  default: {
    name: 'PvMessage',
    template: '<div data-testid="error-message"><slot /></div>',
  },
}));

vi.mock('primevue/select', () => ({
  default: {
    name: 'PvSelect',
    props: ['modelValue', 'options', 'placeholder'],
    emits: ['change', 'update:modelValue'],
    template: `
      <select
        data-testid="task-select"
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value); $emit('change', { value: $event.target.value })"
      >
        <option value="">{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    `,
  },
}));

vi.mock('@/composables/queries/useBucketTaskListQuery', () => ({
  TASK_DISPLAY_NAMES: {
    'hearts-and-flowers': 'Hearts and Flowers',
    vocab: 'Vocabulary',
  },
  useBucketTaskListQuery: () => ({
    data: computed(() => bucketTaskList.value),
    error: computed(() => bucketTaskListError.value),
    isError: computed(() => isErrorBucketTaskList.value),
  }),
}));

vi.mock('@/composables/queries/useBucketTaskTranslationsQuery', () => ({
  useBucketTaskTranslationsQuery: () => ({
    data: computed(() => bucketTaskTranslations.value),
    error: computed(() => bucketTaskTranslationsError.value),
    isError: computed(() => isErrorBucketTaskTranslations.value),
    isLoading: computed(() => isLoadingBucketTaskTranslations.value),
  }),
}));

vi.mock('@/composables/queries/useBucketAudioListQuery', () => ({
  useBucketAudioListQuery: () => ({
    data: computed(() => bucketAudioList.value),
    isLoading: computed(() => isLoadingBucketAudioList.value),
  }),
}));

function mountTranslations() {
  return mount(Translations, {
    global: {
      directives: {
        tooltip: () => {},
      },
      stubs: {
        RouterLink: true,
      },
    },
  });
}

beforeEach(() => {
  bucketAudioList.value = [
    {
      audioKey: 'hf_prompt_1',
      url: 'https://example.com/audio/hf_prompt_1.mp3',
    },
  ];
  bucketTaskList.value = [
    {
      label: 'Hearts and Flowers',
      value: 'hearts-and-flowers',
    },
    {
      label: 'Vocabulary',
      value: 'vocab',
    },
  ];
  bucketTaskListError.value = null;
  bucketTaskTranslations.value = [
    {
      audioKey: 'hf_prompt_1',
      englishSourceString: 'Touch the flower.',
      translationText: 'Toca la flor.',
    },
    {
      audioKey: 'hf_prompt_2',
      englishSourceString: 'Touch the heart.',
      translationText: 'Toca el corazon.',
    },
  ];
  bucketTaskTranslationsError.value = null;
  isErrorBucketTaskList.value = false;
  isErrorBucketTaskTranslations.value = false;
  isLoadingBucketAudioList.value = false;
  isLoadingBucketTaskTranslations.value = false;
  locale.value = 'es-CO';
  mockAudioPause.mockClear();
  mockAudioPlay.mockClear();
  mockRouterPush.mockClear();
  routeParams.taskId = 'hearts-and-flowers';

  window.Audio = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    pause: mockAudioPause,
    play: mockAudioPlay,
  }));
});

describe('Translations.vue', () => {
  it('renders task translations with matching audio data', () => {
    const wrapper = mountTranslations();
    const dataTable = wrapper.findComponent({ name: 'PvDataTable' });

    expect(wrapper.text()).toContain('Language');
    expect(wrapper.text()).toContain('Task');
    expect(wrapper.text()).toContain('Translations for Hearts and Flowers (Español (Colombia))');
    expect(wrapper.text()).toContain('Total entries: 2');
    expect(wrapper.find('[data-testid="export-filename"]').text()).toBe('translations_hearts-and-flowers_es-co');
    expect(dataTable.props('loading')).toBe(false);
    expect(dataTable.props('value')).toEqual([
      {
        audio: {
          audioKey: 'hf_prompt_1',
          url: 'https://example.com/audio/hf_prompt_1.mp3',
        },
        audioKey: 'hf_prompt_1',
        englishSourceString: 'Touch the flower.',
        translationText: 'Toca la flor.',
      },
      {
        audio: null,
        audioKey: 'hf_prompt_2',
        englishSourceString: 'Touch the heart.',
        translationText: 'Toca el corazon.',
      },
    ]);
  });

  it('shows the empty table message when no task is selected', () => {
    routeParams.taskId = undefined;
    bucketTaskTranslations.value = [];

    const wrapper = mountTranslations();

    expect(wrapper.text()).toContain('Select a language and a task to view translations');
    expect(wrapper.text()).not.toContain('Translations for Hearts and Flowers');
  });

  it('navigates when the selected task changes', async () => {
    const wrapper = mountTranslations();

    await wrapper.find('[data-testid="task-select"]').setValue('vocab');

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: 'Translations',
      params: {
        taskId: 'vocab',
      },
    });
  });

  it('renders query errors instead of the table', () => {
    bucketTaskListError.value = new Error('Unable to load tasks');
    bucketTaskTranslationsError.value = new Error('Unable to load translations');
    isErrorBucketTaskList.value = true;
    isErrorBucketTaskTranslations.value = true;

    const wrapper = mountTranslations();

    expect(wrapper.find('[data-testid="translations-table"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Unable to load tasks');
    expect(wrapper.text()).toContain('Unable to load translations');
  });

  it('plays and pauses audio for a selected translation', () => {
    const wrapper = mountTranslations();
    const url = 'https://example.com/audio/hf_prompt_1.mp3';

    wrapper.vm.toggleAudio(url);
    wrapper.vm.toggleAudio(url);
    wrapper.vm.toggleAudio(url);

    expect(window.Audio).toHaveBeenCalledWith(url);
    expect(mockAudioPlay).toHaveBeenCalledTimes(2);
    expect(mockAudioPause).toHaveBeenCalledTimes(1);
  });
});
