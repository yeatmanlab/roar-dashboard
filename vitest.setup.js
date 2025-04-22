import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { languageOptions } from '@/translations/i18n';

const locale = 'en';

config.global.mocks = {
  $t: (msg) => languageOptions[locale]?.translations[msg],
};

vi.mock('vue-recaptcha', () => ({
  default: {},
  useRecaptchaProvider: vi.fn(),
  VueRecaptchaPlugin: vi.fn(),
}));

// Mock the $t function based on the logic in i18n.js
config.global.mocks = {
  $t: (key) => {
    const locale = 'en-US';
    return languageOptions[locale]?.translations[key];
  },
};
