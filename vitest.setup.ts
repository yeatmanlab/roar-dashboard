import { vi } from 'vitest';
import { config } from '@vue/test-utils';
// @ts-ignore - Linter struggles with resolving .ts file via alias here, but build/tests work
import { languageOptions } from '@/translations/i18n';

const locale = 'en';
// ... existing code ...
