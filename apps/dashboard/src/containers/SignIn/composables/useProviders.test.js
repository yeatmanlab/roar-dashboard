import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useProviders } from './useProviders';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';

const mocks = vi.hoisted(() => ({
  fetchSignInMethodsForEmail: vi.fn(),
}));

vi.mock('@/services/AuthService', () => ({
  getAuthService: () => ({
    fetchSignInMethodsForEmail: mocks.fetchSignInMethodsForEmail,
  }),
}));

describe('useProviders', () => {
  let mockOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOptions = {
      email: ref(''),
      isUsername: ref(false),
      availableProviders: ref([]),
      hasCheckedProviders: ref(false),
      multipleProviders: ref(false),
      hideProviders: ref(false),
      showPasswordField: ref(false),
      discoveryError: ref(false),
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
    it('should fetch and normalize providers via the AuthService', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue(['password', 'google.com']);
      mockOptions.email.value = 'test@example.com';

      const { getProviders } = useProviders(mockOptions);

      const result = await getProviders();

      expect(mocks.fetchSignInMethodsForEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toContain('password');
      expect(result).toContain(AUTH_SSO_PROVIDERS.GOOGLE);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should handle empty results', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue([]);
      mockOptions.email.value = 'test@example.com';

      const { getProviders } = useProviders(mockOptions);

      const result = await getProviders();

      expect(result).toEqual([]);
      expect(mockOptions.availableProviders.value).toEqual([]);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should trim and lowercase email before fetching', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue([]);
      mockOptions.email.value = '  TEST@EXAMPLE.COM  ';

      const { getProviders } = useProviders(mockOptions);

      await getProviders();

      expect(mocks.fetchSignInMethodsForEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should propagate discovery errors', async () => {
      mocks.fetchSignInMethodsForEmail.mockRejectedValue(new Error('network error'));
      mockOptions.email.value = 'test@example.com';

      const { getProviders } = useProviders(mockOptions);

      await expect(getProviders()).rejects.toThrow('network error');
      expect(mockOptions.hasCheckedProviders.value).toBe(false);
    });
  });

  describe('checkAvailableProviders', () => {
    it('should handle username path without calling the AuthService', async () => {
      mockOptions.isUsername.value = true;
      mockOptions.email.value = 'testuser';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders('testuser');

      expect(mocks.fetchSignInMethodsForEmail).not.toHaveBeenCalled();
      expect(mockOptions.showPasswordField.value).toBe(true);
      expect(mockOptions.availableProviders.value).toEqual(['password']);
      expect(mockOptions.hideProviders.value).toBe(true);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should set email if triggeredEmail is provided', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue([]);

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders('  newemail@example.com  ');

      expect(mockOptions.email.value).toBe('newemail@example.com');
    });

    it('should handle multiple SSO providers', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue([AUTH_SSO_PROVIDERS.GOOGLE, AUTH_SSO_PROVIDERS.CLEVER]);
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.multipleProviders.value).toBe(true);
      expect(mockOptions.showPasswordField.value).toBe(false);
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should auto-continue on a single SSO provider', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue([AUTH_SSO_PROVIDERS.GOOGLE]);
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.authWithGoogle).toHaveBeenCalled();
      expect(mockOptions.hasCheckedProviders.value).toBe(true);
    });

    it('should show password field when no providers found', async () => {
      mocks.fetchSignInMethodsForEmail.mockResolvedValue([]);
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.showPasswordField.value).toBe(true);
      expect(mockOptions.hideProviders.value).toBe(true);
    });

    it('should surface a discovery error instead of degrading to password', async () => {
      mocks.fetchSignInMethodsForEmail.mockRejectedValue(new Error('network error'));
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.discoveryError.value).toBe(true);
      expect(mockOptions.showPasswordField.value).toBe(false);
      expect(mockOptions.hasCheckedProviders.value).toBe(false);
      expect(mockOptions.availableProviders.value).toEqual([]);
    });

    it('should clear a previous discovery error on retry', async () => {
      mockOptions.discoveryError.value = true;
      mocks.fetchSignInMethodsForEmail.mockResolvedValue(['password']);
      mockOptions.email.value = 'test@example.com';

      const { checkAvailableProviders } = useProviders(mockOptions);

      await checkAvailableProviders();

      expect(mockOptions.discoveryError.value).toBe(false);
      expect(mockOptions.showPasswordField.value).toBe(true);
    });
  });
});
