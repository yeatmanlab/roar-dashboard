import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { languageOptions } from '@/translations/i18n';

const locale = 'en';

config.global.mocks = {
  $t: (msg) => translations[locale][msg],
};

vi.mock('vue-recaptcha', () => ({
  default: {},
  useRecaptchaProvider: vi.fn(),
  VueRecaptchaPlugin: vi.fn(),
}));

vi.mock('vue-google-maps-community-fork', () => ({
  default: {},
  VueGoogleMaps: vi.fn(),
}));

// Mock the $t function based on the logic in i18n.js
config.global.mocks = {
  $t: (key) => {
    const locale = 'en-US';
    return languageOptions[locale]?.translations[key];
  },
};
