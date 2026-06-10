import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import SurveyManager from '@/pages/SurveyManager.vue';

const state = vi.hoisted(() => ({
  isSuperAdmin: true,
  locale: { __v_isRef: true, value: 'en' },
  route: {
    query: {},
    params: {},
  },
  surveyListData: { __v_isRef: true, value: [] },
  surveyData: { __v_isRef: true, value: null },
  isSurveyFetching: { __v_isRef: true, value: false },
  routerPushes: [],
  resolvedRoutes: [],
  surveyListQueryArgs: [],
  surveyQueryArgs: [],
  surveyModels: [],
  surveyPDFs: [],
  creators: [],
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: state.locale,
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => state.route,
  useRouter: () => ({
    push: (route) => {
      state.routerPushes.push(route);
    },
    resolve: (route) => {
      state.resolvedRoutes.push(route);
      return {
        href: `/surveys/${route.params.surveyId}/${route.params.surveyLanguage}/${route.params.surveyPreview}`,
      };
    },
  }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    isUserSuperAdmin: () => state.isSuperAdmin,
  }),
}));

vi.mock('@/composables/queries/useSurveyListQuery', () => ({
  useSurveyListQuery: (bucketId) => {
    state.surveyListQueryArgs.push(bucketId);
    return {
      data: state.surveyListData,
    };
  },
}));

vi.mock('@/composables/queries/useSurveyQuery', () => ({
  useSurveyQuery: (bucketId, surveyId) => {
    state.surveyQueryArgs.push({ bucketId, surveyId });
    return {
      data: state.surveyData,
      isFetching: state.isSurveyFetching,
    };
  },
}));

vi.mock('@/helpers/survey', () => ({
  getParsedLocale: (locale) => locale.toUpperCase(),
  getPlainSurveyData: (survey) => ({ ...survey }),
}));

vi.mock('@/components/LanguageSelector.vue', () => ({
  default: {
    name: 'LanguageSelector',
    template: '<div data-testid="language-selector" />',
  },
}));

vi.mock('primevue/select', () => ({
  default: {
    name: 'PvSelect',
    props: ['modelValue', 'options', 'placeholder', 'emptyMessage', 'optionLabel', 'optionValue'],
    emits: ['update:modelValue', 'change'],
    template:
      '<select :data-placeholder="placeholder" :value="modelValue ?? \'\'" @change="$emit(\'change\', { value: $event.target.value || null })"><option value=""></option><option v-for="option in options" :key="option.id" :value="option.id">{{ option.name }}</option></select>',
  },
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'PvButton',
    props: ['as', 'href', 'target', 'disabled', 'variant'],
    emits: ['click'],
    template:
      '<a v-if="as === \'a\'" :href="href" :target="target"><slot /></a><button v-else :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock('survey-core', () => ({
  Model: class MockModel {
    constructor(data) {
      this.data = data;
      state.surveyModels.push(data);
    }
  },
}));

vi.mock('survey-creator-core', () => ({
  SC2020: {
    cssVariables: {},
  },
  SurveyCreatorModel: class MockSurveyCreatorModel {
    constructor(options) {
      this.options = options;
      this._json = {};
      this.text = '{}';
      this.saveSurveyFunc = null;
      this.applyCreatorTheme = vi.fn();
      state.creators.push(this);
    }

    get JSON() {
      return this._json;
    }

    set JSON(value) {
      this._json = value;
      this.text = JSON.stringify(value);
    }
  },
}));

vi.mock('survey-creator-vue', () => ({
  SurveyCreatorComponent: {
    name: 'SurveyCreatorComponent',
    props: ['model'],
    template: '<div data-testid="survey-creator" />',
  },
}));

vi.mock('survey-vue3-ui', () => ({
  SurveyComponent: {
    name: 'SurveyComponent',
    props: ['model'],
    template: '<div data-testid="survey-preview" />',
  },
}));

vi.mock('survey-pdf', () => ({
  SurveyPDF: class MockSurveyPDF {
    constructor(data, options) {
      this.data = data;
      this.options = options;
      this.save = vi.fn().mockResolvedValue();
      state.surveyPDFs.push(this);
    }
  },
}));

const PvSelectStub = {
  name: 'PvSelect',
  props: ['modelValue', 'options', 'placeholder', 'emptyMessage', 'optionLabel', 'optionValue'],
  emits: ['update:modelValue', 'change'],
  template:
    '<select :data-placeholder="placeholder" :value="modelValue ?? \'\'" @change="$emit(\'change\', { value: $event.target.value || null })"><option value=""></option><option v-for="option in options" :key="option.id" :value="option.id">{{ option.name }}</option></select>',
};

const PvButtonStub = {
  name: 'PvButton',
  props: ['as', 'href', 'target', 'disabled', 'variant'],
  emits: ['click'],
  template:
    '<a v-if="as === \'a\'" :href="href" :target="target"><slot /></a><button v-else :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
};

const RouterLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a data-testid="router-link"><slot /></a>',
};

const mountSurveyManager = () =>
  mount(SurveyManager, {
    global: {
      stubs: {
        PvButton: PvButtonStub,
        PvSelect: PvSelectStub,
        RouterLink: RouterLinkStub,
      },
    },
  });

describe('SurveyManager.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    state.isSuperAdmin = true;
    state.locale.value = 'en';
    state.route.query = {};
    state.route.params = {};
    state.surveyListData.value = [
      { id: 'intake', name: 'Intake Survey' },
      { id: 'follow-up', name: 'Follow-up Survey' },
    ];
    state.surveyData.value = null;
    state.isSurveyFetching.value = false;
    state.routerPushes.length = 0;
    state.resolvedRoutes.length = 0;
    state.surveyListQueryArgs.length = 0;
    state.surveyQueryArgs.length = 0;
    state.surveyModels.length = 0;
    state.surveyPDFs.length = 0;
    state.creators.length = 0;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders bucket controls and dashboard link for super admins', () => {
    const wrapper = mountSurveyManager();

    expect(wrapper.find('.survey-manager').exists()).toBe(true);
    expect(wrapper.find('[data-testid="survey-creator"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="language-selector"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Bucket');
    expect(wrapper.text()).toContain('Return to Dashboard');
    expect(state.creators[0].options).toMatchObject({
      autoSaveEnabled: true,
      showDesignerTab: true,
      showJSONEditorTab: true,
    });
  });

  it('renders the language selector instead of bucket controls for non-super admins', () => {
    state.isSuperAdmin = false;

    const wrapper = mountSurveyManager();

    expect(wrapper.find('[data-testid="language-selector"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Bucket');
    expect(wrapper.text()).not.toContain('Return to Dashboard');
    expect(state.creators[0].options).toMatchObject({
      autoSaveEnabled: false,
      showDesignerTab: false,
      showJSONEditorTab: false,
    });
  });

  it('uses route values to request surveys and build a full preview URL', () => {
    state.route.query = { bucketId: 'levante-assets-draft' };
    state.route.params = { surveyId: 'intake', surveyLanguage: 'es-CO' };
    state.surveyData.value = { title: 'Intake', pages: [] };

    const wrapper = mountSurveyManager();

    expect(state.surveyListQueryArgs[0].value).toBe('levante-assets-draft');
    expect(state.surveyQueryArgs[0].bucketId.value).toBe('levante-assets-draft');
    expect(state.surveyQueryArgs[0].surveyId.value).toBe('intake');
    expect(wrapper.find('a[href="/surveys/intake/es-CO/preview"]').exists()).toBe(true);
    expect(state.resolvedRoutes).toContainEqual({
      name: 'SurveyManager',
      params: {
        surveyPreview: 'preview',
        surveyId: 'intake',
        surveyLanguage: 'es-CO',
      },
    });
  });

  it('loads survey data into the creator with the selected locale', async () => {
    state.route.params = { surveyId: 'intake', surveyLanguage: 'es-MX' };
    state.surveyData.value = { title: 'Intake', pages: [{ name: 'page-1' }] };

    mountSurveyManager();
    await nextTick();

    expect(state.creators[0].JSON).toEqual({
      title: 'Intake',
      pages: [{ name: 'page-1' }],
      locale: 'ES-MX',
    });
  });

  it('renders preview mode with a SurveyJS model', async () => {
    state.route.params = {
      surveyPreview: 'preview',
      surveyId: 'intake',
      surveyLanguage: 'fr-CA',
    };
    state.surveyData.value = { title: 'Preview survey', pages: [] };

    const wrapper = mountSurveyManager();
    await nextTick();

    expect(wrapper.find('[data-testid="survey-preview"]').exists()).toBe(true);
    expect(wrapper.find('.survey-manager').exists()).toBe(false);
    expect(state.surveyModels).toEqual([
      {
        title: 'Preview survey',
        pages: [],
        locale: 'FR-CA',
      },
    ]);
  });

  it('redirects from preview mode when no survey is selected', async () => {
    state.route.params = { surveyPreview: 'preview' };

    mountSurveyManager();
    await nextTick();

    expect(state.routerPushes).toEqual([{ name: 'SurveyManager' }]);
  });

  it('persists the active survey draft when the creator saves', () => {
    state.route.query = { bucketId: 'levante-assets-draft' };
    state.route.params = { surveyId: 'intake' };
    const wrapper = mountSurveyManager();
    const callback = vi.fn();

    state.creators[0].text = '{"title":"Draft"}';
    state.creators[0].saveSurveyFunc(7, callback);

    expect(window.sessionStorage.getItem('levanteBucketId')).toBe('levante-assets-draft');
    expect(window.sessionStorage.getItem('levanteSurveyId')).toBe('intake');
    expect(window.sessionStorage.getItem('levanteSurvey')).toBe('{"title":"Draft"}');
    expect(callback).toHaveBeenCalledWith(7, true);
    wrapper.unmount();
  });

  it('reverts a survey change when unsaved changes are not discarded', async () => {
    state.route.params = { surveyId: 'intake' };
    state.surveyData.value = { title: 'Intake', pages: [] };
    window.confirm.mockReturnValue(false);
    const wrapper = mountSurveyManager();
    await nextTick();

    state.creators[0].text = '{"title":"Unsaved"}';
    const surveySelect = wrapper.findAll('select').at(1);
    surveySelect.element.value = 'follow-up';
    await surveySelect.trigger('change');
    await flushPromises();

    expect(window.confirm).toHaveBeenCalledWith('Discard unsaved survey changes?');
    expect(state.surveyQueryArgs[0].surveyId.value).toBe('intake');
  });

  it('downloads the selected survey as a localized PDF', async () => {
    state.route.params = { surveyId: 'intake', surveyLanguage: 'pt-BR' };
    state.surveyData.value = { title: 'Printable survey', pages: [] };
    const wrapper = mountSurveyManager();
    await nextTick();

    const downloadButton = wrapper.findAll('button').find((button) => button.text().includes('Download as PDF'));
    await downloadButton.trigger('click');
    await flushPromises();

    expect(state.surveyPDFs[0].data).toEqual({
      title: 'Printable survey',
      pages: [],
      locale: 'PT-BR',
    });
    expect(state.surveyPDFs[0].save).toHaveBeenCalledWith('intake_pt-br');
  });
});
