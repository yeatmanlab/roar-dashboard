import { vi } from 'vitest';
import { config, DOMWrapper } from '@vue/test-utils';

vi.mock('vue-recaptcha', () => ({
  default: {},
  useRecaptchaProvider: vi.fn(),
  VueRecaptchaPlugin: vi.fn(),
}));

vi.mock('vue-google-maps-community-fork', () => ({
  default: {},
  VueGoogleMaps: vi.fn(),
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
