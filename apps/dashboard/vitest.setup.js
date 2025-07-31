import { vi } from 'vitest';
import { config, DOMWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import translations from 'src/translations/en/en-componentTranslations.json' with { type: 'json' };

vi.mock('vue-recaptcha', () => ({
  default: {},
  useRecaptchaProvider: vi.fn(),
  VueRecaptchaPlugin: vi.fn(),
}));

vi.mock('vue-google-maps-community-fork', () => ({
  default: {},
  VueGoogleMaps: vi.fn(),
}));

// Mock the Firekit initialization function
vi.mock('./src/firekit.js', () => ({
  initializeFirekit: vi.fn(),
}));

const DataTestIdPlugin = (wrapper) => {
  function findByTestId(selector) {
    const dataSelector = `[data-testid='${selector}']`;
    const element = wrapper.element.querySelector(dataSelector);
    return new DOMWrapper(element);
  }

  return {
    findByTestId,
  };
};

config.plugins.VueWrapper.install(DataTestIdPlugin);

// Load PrimeVue config
// @NOTE: This is required for unit tests to correctly mount and render components that leverage a PrimeVue component.
config.global.plugins.push(PrimeVue);

// Mock the $t function based on the logic in i18n.js
config.global.mocks = {
  $t: (key) => {
    return translations[key];
  },
};
