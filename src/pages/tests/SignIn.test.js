import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import SignIn from '@/pages/SignIn.vue';

// Create mock auth store for testing
const authStoreMock = {
  logInWithEmailAndPassword: vi.fn(),
  initiateLoginWithEmailLink: vi.fn(),
  signInWithGooglePopup: vi.fn(),
  signInWithGoogleRedirect: vi.fn(),
  spinner: false,
  uid: null,
  $subscribe: vi.fn(),
};

// Mocking behavior setup - must be separate from the mock implementation
let isMobileBrowserMock = false;

// Mock all dependencies to avoid issues
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(() => authStoreMock),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock('@/helpers', () => ({
  isLevante: true,
  isMobileBrowser: vi.fn(() => isMobileBrowserMock),
}));

vi.mock('@/helpers/query/utils', () => ({
  fetchDocById: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/constants/auth', () => ({
  AUTH_SSO_PROVIDERS: {
    GOOGLE: 'google',
  },
}));

vi.mock('@/constants/routes', () => ({
  APP_ROUTES: {
    HOME: '/home',
  },
}));

// Mock survey initialization to avoid AudioContext issues
vi.mock('@/helpers/surveyInitialization', () => ({}));

vi.mock('@/helpers/survey', () => ({
  fetchAudioLinks: vi.fn(),
  getParsedLocale: vi.fn(),
  restoreSurveyData: vi.fn(),
  saveSurveyData: vi.fn(),
  saveFinalSurveyData: vi.fn(),
  fetchBuffer: vi.fn(),
  showAndPlaceAudioButton: vi.fn(),
}));

// Mock audio helpers that use AudioContext
vi.mock('@/helpers/audio', () => ({
  BufferLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    loadBuffer: vi.fn(),
  })),
}));

// Create a working stub for the SignIn component that can emit events
const SignInStub = {
  name: 'SignIn',
  template: '<div class="sign-in-stub"></div>',
  emits: ['submit', 'update:email'],
  methods: {
    emitSubmit(data) {
      this.$emit('submit', data);
    },
    emitUpdateEmail(email) {
      this.$emit('update:email', email);
    },
  },
};

// Mock storeToRefs since this is causing issues
vi.mock('pinia', () => ({
  storeToRefs: vi.fn(() => ({
    spinner: { value: false },
    ssoProvider: { value: null },
    routeToProfile: { value: false },
    roarfirekit: { value: { fetchEmailAuthMethods: vi.fn() } },
  })),
}));

// Mock PostHog
vi.mock('@/plugins/posthog', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

describe('SignIn.vue', () => {
  let wrapper;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Reset mock implementations
    isMobileBrowserMock = false; // Default to desktop browser

    // Reset auth store mock's implementation for each test
    authStoreMock.logInWithEmailAndPassword.mockReset();
    authStoreMock.signInWithGooglePopup.mockReset();
    authStoreMock.signInWithGoogleRedirect.mockReset();

    // Mock console error to avoid test noise
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mount the component with our SignInStub
    wrapper = shallowMount(SignIn, {
      global: {
        stubs: {
          SignIn: SignInStub,
          AppSpinner: true,
          LanguageSelector: true,
          RoarModal: true,
          PvImage: true,
          PvButton: true,
          PvPassword: true,
          'i18n-t': true,
        },
        mocks: {
          $t: (key) => key,
        },
      },
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('renders the sign-in page', () => {
    expect(wrapper.find('#signin-container').exists()).toBe(true);
  });

  // Rather than testing internal component state, we directly test if the emitted event
  // from the child component calls the expected method with correct arguments
  it('has a method called authWithEmail that handles email authentication', async () => {
    // Setup successful login response
    authStoreMock.logInWithEmailAndPassword.mockResolvedValue({});

    // Extract the authWithEmail method from wrapper's vm context
    const instance = wrapper.vm;
    expect(typeof instance.authWithEmail).toBe('function');

    // Create test credentials
    const credentials = {
      email: 'test@example.com',
      password: 'password123',
      usePassword: true,
      useLink: false,
    };

    // Call the method directly
    await instance.authWithEmail(credentials);

    // Verify the auth store login method was called with the expected credentials
    expect(authStoreMock.logInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
      }),
    );
  });

  it('shows error message for invalid username or password', async () => {
    // Setup auth store to reject with auth error
    const authError = new Error('Invalid login');
    authError.code = 'auth/wrong-password';
    authStoreMock.logInWithEmailAndPassword.mockRejectedValue(authError);

    // Extract the authWithEmail method from wrapper's vm context
    const instance = wrapper.vm;

    // Verify 'incorrect' is initially false
    expect(instance.incorrect).toBe(false);

    // Create test credentials
    const credentials = {
      email: 'test@example.com',
      password: 'wrongPassword',
      usePassword: true,
      useLink: false,
    };

    // Call the method directly
    await instance.authWithEmail(credentials);

    // Verify 'incorrect' was set to true after auth failure
    expect(instance.incorrect).toBe(true);

    // Verify the auth store was called
    expect(authStoreMock.logInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'wrongPassword',
      }),
    );
  });

  it('initiates login with email link when useLink is true', async () => {
    // Setup successful login response
    authStoreMock.initiateLoginWithEmailLink.mockResolvedValue({});

    // Extract the authWithEmail method from wrapper's vm context
    const instance = wrapper.vm;

    // Create test credentials for email link
    const credentials = {
      email: 'test@example.com',
      usePassword: false,
      useLink: true,
    };

    // Call the method directly
    await instance.authWithEmail(credentials);

    // Verify the email link method was called
    expect(authStoreMock.initiateLoginWithEmailLink).toHaveBeenCalledWith({
      email: 'test@example.com',
    });
  });

  it('uses Google popup for desktop browser authentication', async () => {
    // Setup successful Google popup login
    authStoreMock.signInWithGooglePopup.mockResolvedValue({});

    // Ensure isMobileBrowser returns false (desktop)
    isMobileBrowserMock = false;

    // Extract the authWithGoogle method from wrapper's vm context
    const instance = wrapper.vm;
    expect(typeof instance.authWithGoogle).toBe('function');

    // Call the method directly
    await instance.authWithGoogle();

    // Verify the Google popup method was called
    expect(authStoreMock.signInWithGooglePopup).toHaveBeenCalled();
    expect(authStoreMock.signInWithGoogleRedirect).not.toHaveBeenCalled();
  });

  it('uses Google redirect for mobile browser authentication', async () => {
    // Setup mobile browser detection
    isMobileBrowserMock = true;

    // Extract the authWithGoogle method from wrapper's vm context
    const instance = wrapper.vm;
    expect(typeof instance.authWithGoogle).toBe('function');

    // Call the method directly
    await instance.authWithGoogle();

    // Verify the Google redirect method was called
    expect(authStoreMock.signInWithGoogleRedirect).toHaveBeenCalled();
    expect(authStoreMock.signInWithGooglePopup).not.toHaveBeenCalled();
  });
});
