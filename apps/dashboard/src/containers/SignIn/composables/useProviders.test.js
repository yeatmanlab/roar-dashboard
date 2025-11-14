import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useProviders } from './useProviders';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';

describe('useProviders', () => {
  let mockOptions;

  beforeEach(() => {
    mockOptions = {
      email: ref(''),
      isUsername: ref(false),
      availableProviders: ref([]),
      hasCheckedProviders: ref(false),
      multipleProviders: ref(false),
      hideProviders: ref(false),
      showPasswordField: ref(false),
      roarfirekit: ref(null),
      authWithGoogle: vi.fn(),
      authWithClever: vi.fn(),
      authWithClassLink: vi.fn(),
      authWithNYCPS: vi.fn(),
      invalid: ref(false),
    };
  });

  describe('normalizeProviders', () => {
    it('should normalize password providers', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['password']);
      expect(result).toContain('password');
    });

    it('should normalize emaillink to password', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['emaillink']);
      expect(result).toContain('password');
    });

    it('should normalize google provider', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['google.com']);
      expect(result).toContain(AUTH_SSO_PROVIDERS.GOOGLE);
    });

    it('should normalize clever provider', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['oidc.clever']);
      expect(result).toContain(AUTH_SSO_PROVIDERS.CLEVER);
    });

    it('should normalize classlink provider', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['oidc.classlink']);
      expect(result).toContain(AUTH_SSO_PROVIDERS.CLASSLINK);
    });

    it('should normalize nycps provider', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['oidc.nycps']);
      expect(result).toContain(AUTH_SSO_PROVIDERS.NYCPS);
    });

    it('should handle case insensitivity', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['PASSWORD', 'GOOGLE.COM']);
      expect(result).toContain('password');
      expect(result).toContain(AUTH_SSO_PROVIDERS.GOOGLE);
    });

    it('should remove duplicates', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders(['password', 'emaillink']);
      expect(result.filter((p) => p === 'password').length).toBe(1);
    });

    it('should handle empty array', async () => {
      const { normalizeProviders } = useProviders(mockOptions);

      const result = await normalizeProviders([]);
      expect(result).toEqual([]);
    });
  });

  describe('getProviders', () => {
    it('should return empty array if roarfirekit is null', async () => {
      const { getProviders } = useProviders(mockOptions);

      const result = await getProviders();

      expect(result).toEqual([]);
      expect(mockOptions.availableProviders.value).toEqual([]);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should fetch and normalize providers', async () => {
      const mockKit = {
        fetchEmailAuthMethods: vi.fn().mockResolvedValue(['password', 'google.com']),
      };

      mockOptions.roarfirekit.value = mockKit;
      mockOptions.email.value = 'test@example.com';

      const { getProviders } = useProviders(mockOptions);

      const result = await getProviders();

      expect(mockKit.fetchEmailAuthMethods).toHaveBeenCalledWith('test@example.com');
      expect(result).toContain('password');
      expect(result).toContain(AUTH_SSO_PROVIDERS.GOOGLE);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should trim and lowercase email before fetching', async () => {
      const mockKit = {
        fetchEmailAuthMethods: vi.fn().mockResolvedValue([]),
      };

      mockOptions.roarfirekit.value = mockKit;
      mockOptions.email.value = '  TEST@EXAMPLE.COM  ';

      const { getProviders } = useProviders(mockOptions);

      await getProviders();

      expect(mockKit.fetchEmailAuthMethods).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('checkAvailableProviders', () => {
    it('should handle username path', async () => {
      mockOptions.isUsername.value = true;
      mockOptions.email.value = 'testuser';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders('testuser');

      expect(mockOptions.showPasswordField.value).toBe(true);
      expect(mockOptions.availableProviders.value).toEqual(['password']);
      expect(mockOptions.hideProviders.value).toBe(true);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should set email if triggeredEmail is provided', async () => {
      mockOptions.roarfirekit.value = {
        fetchEmailAuthMethods: vi.fn().mockResolvedValue([]),
      };

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders('  newemail@example.com  ');

      expect(mockOptions.email.value).toBe('newemail@example.com');
    });

    it('should handle multiple SSO providers', async () => {
      const mockKit = {
        fetchEmailAuthMethods: vi.fn().mockResolvedValue([AUTH_SSO_PROVIDERS.GOOGLE, AUTH_SSO_PROVIDERS.CLEVER]),
      };

      mockOptions.roarfirekit.value = mockKit;
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should handle single provider', async () => {
      const mockKit = {
        fetchEmailAuthMethods: vi.fn().mockResolvedValue([AUTH_SSO_PROVIDERS.GOOGLE]),
      };

      mockOptions.roarfirekit.value = mockKit;
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should show password field when no providers found', async () => {
      const mockKit = {
        fetchEmailAuthMethods: vi.fn().mockResolvedValue([]),
      };

      mockOptions.roarfirekit.value = mockKit;
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.showPasswordField.value).toBe(true);
      expect(mockOptions.hideProviders.value).toBe(true);
    });
  });
});
